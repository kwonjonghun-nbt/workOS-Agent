---
name: extension-ai
description: workOS-Agent 의 확장 프로그램(Extensions)에서 AI(claude CLI) 기능을 개발/검수할 때 사용. 라벨 추천·리포트 생성처럼 확장이 claude 를 호출해 결과를 받아야 하는 기능을 추가하거나 리뷰할 때, "확장 AI", "extension ai", "claude cli", "터미널 패널", "AI Terminal", "TerminalLlmRepository", "ExtensionLlmRuntime", "workos_extension_llm_result", "MCP callback", "확장 LLM" 키워드가 나오거나 `electron/repositories/terminal-llm.repo.ts`, `electron/services/extension-llm-runtime.ts`, `electron/services/terminal.service.ts (ensureExtensionSession/appendSessionData)`, `electron/mcp/workos-mcp-server.mjs` 의 확장 LLM 도구, `electron/contracts/mcp.ts` 의 `workos_extension_llm_result` 항목, `src/business/extension/extension-store.ts` 의 terminal slot 상태, `src/presentation/features/extensions/ExtensionTerminalPanel.tsx`, `src/business/terminal/use-extension-terminal-list.ts` 등을 다룰 때 사용한다.
---

# Extension AI Skill — 확장의 AI(claude CLI) 기능 개발 가이드

확장이 AI(claude CLI) 를 사용해 결과를 받아야 하는 기능 — 예: Jira 라벨 추천, 리포트 생성 — 의 표준 패턴과 검수 항목.

## 핵심 원칙 (깨면 일관성이 무너진다)

1. **AI 작업은 사용자에게 보여야 한다.** 헤드리스 child_process 로 숨어 도는 게 아니라, 확장 전용 PTY 터미널 패널에서 사용자가 실행 과정을 본다.
2. **확장은 SYSTEM_DEFAULT_WORKSPACE 의 자기 sub-cwd 에서만 돈다.** 사용자 워크스페이스 디렉토리에 절대 쓰지 않는다. `WorkspaceService.resolveExtensionCwd(SYSTEM_DEFAULT_WORKSPACE_ID, extensionId)` 만 사용.
3. **claude 실행은 WorkOS 패턴이다.** 즉 `claude --dangerously-skip-permissions "Read the file at <prompt-path> and execute the instructions inside as if they were my next request."` 한 줄을 PTY 에 보낸다. `-p` 옵션, 셸 파이프라인, 마커 검출 같은 우회 절대 금지.
4. **결과 회수는 MCP 도구 콜백이다.** `workos_extension_llm_result({ requestId, content | error })` 를 claude 가 호출하면 host 가 pending Promise 를 해소. stdout 파싱, 출력 파일 폴링 등 다른 채널 도입 금지.
5. **prompt 파일은 임시 파일이다.** 작성 후 30초 (`PROMPT_CLEANUP_MS`) 안에 자동 삭제. 영구 저장 안 한다.
6. **비밀은 env 로만 흘려보낸다.** 확장 settings 의 secret 필드는 `EXT_<UPPER_KEY>` env 로 PTY 와 claude child 에 주입. 파일이나 PTY input 으로 평문 송신 금지.
7. **AI 실행 시 패널을 자동으로 연다.** `extension:openPanel` 이벤트를 broadcast → 렌더러가 activity view + AI Terminal + active 세션을 자동 세팅.
8. **claude 의 결과는 그대로 받는다.** 서비스 단에서 후처리 (요약, 자르기) 가 필요하면 prompt 가 그렇게 시키도록 작성한다 — host 가 후처리하지 않는다.

## 아키텍처 한눈

```
┌────────────── Renderer ──────────────┐
│ ExtensionsSidebar                    │
│   └ ExtensionTerminalPanel (멀티탭)  │ ← extension:openPanel 수신 시
│      └ TerminalView (xterm)          │   activity view + 패널 + 세션
└──────────────────────────────────────┘
            ↑ stdout stream     ↓ user input (옵션)
─────────────────────── IPC ──────────────────────
┌────────────────── Main ──────────────────────┐
│                                              │
│  JiraReportService / JiraLabelService        │
│        ↓ runText(prompt)                     │
│  TerminalLlmRepository ◀───────┐             │
│   1. resolveExtensionCwd       │             │
│   2. mcpService.setupAt(...)   │             │
│   3. write prompt file (30s)   │             │
│   4. ensureExtensionSession    │             │
│   5. broadcast openPanel       │             │
│   6. terminal.write(claude…)   │             │
│   7. runtime.register(reqId)   ─┐            │
│                                 │            │
│  ExtensionLlmRuntime ◀──── submit(reqId)     │
│   pending Map<reqId, Promise>   ▲            │
│                                 │            │
│  McpControlPlane  /v1/extension/llm-result   │
│        ▲                                     │
└────────┼─────────────────────────────────────┘
         │ HTTP (bearer + workspace header)
─────────┼─────────────────────────────────────
         │
  claude CLI (PTY child)
   ├─ reads .mcp.json + .mcp-session.json
   └─ calls workos_extension_llm_result(reqId, content)
```

## 표준 흐름 (단계별)

확장 서비스가 AI 호출을 1회 하는 흐름:

```ts
// 1) 서비스가 LlmCliRepository 인터페이스를 의존성으로 받는다 (TerminalLlmRepository 가 주입됨)
class JiraReportService {
  constructor(
    private readonly reports: ReportsRepository,
    private readonly snapshot: JiraSnapshotRepository,
    private readonly labelNotes: LabelNotesRepository,
    private readonly llm: LlmCliRepository,   // ← 추상 타입만 의존
  ) {}

  async generate(req): Promise<{ content: string }> {
    const prompt = buildReportPrompt({ ... });
    // 모델 옵션은 그대로 통과. 결과는 string.
    const content = await this.llm.runText(prompt, { model: req.model });
    return { content: content.trim() };
  }
}
```

`TerminalLlmRepository.runText(prompt, opts)` 내부에서 일어나는 일:

| 단계 | 코드 | 효과 |
|---|---|---|
| 1. 확장 활성 체크 | `extensionService.isEnabled(id)` | 꺼진 확장으로 호출 차단 |
| 2. MCP 준비 체크 | `mcpService.isReady()` | control plane + script 준비 안 됨이면 즉시 에러 |
| 3. cwd 해석 | `workspaceService.resolveExtensionCwd(SYSTEM_DEFAULT, id)` | `{userData}/default-workspace/extensions/<id>/` + `.claude/{agents,skills}` 시드 |
| 4. MCP 설정 시드 | `mcpService.setupAt(cwd, SYSTEM_DEFAULT, false)` | 확장 cwd 에 `.mcp.json` + `.mcp-session.json` |
| 5. prompt 파일 작성 | `<cwd>/.workos-llm/prompt-<reqId>-<ts>.md` + 푸터에 MCP 도구 호출 지시 | claude 가 읽을 입력 |
| 6. 자동 삭제 예약 | `scheduleUnlink(promptPath, 30_000)` | 30초 후 cleanup |
| 7. PTY 세션 확보 | `terminalService.ensureExtensionSession(...)` | 기존 세션 재사용 또는 신규 |
| 8. 패널 오픈 이벤트 | `eventBus.broadcast('extension:openPanel', {extensionId, sessionId})` | 렌더러가 activity view + AI Terminal + active 세션 세팅 |
| 9. 명령 입력 | `terminal.write(sessionId, 'claude --dangerously-skip-permissions "Read ..."\n')` (250ms 지연) | 사용자 가시 |
| 10. pending 등록 | `runtime.register(requestId, timeoutMs)` → `Promise<string>` | 결과 회수 대기 |

prompt 푸터에 들어가는 표준 결과 제출 지시 (`wrapPrompt` 가 생성):

```
---

# 결과 제출 (필수)

위 작업의 최종 결과물을 반드시 다음 MCP 도구로 제출하세요:

workos_extension_llm_result({
  requestId: "<reqId>",
  content: "<결과 전체 — 마크다운/JSON 등 그대로의 문자열>"
})

- content 에는 작업의 최종 결과물 전체를 담으세요. 요약/추출/줄임 금지.
- ... (에러시 error 필드, 1회만 호출 등)
```

claude 가 도구를 호출 → control plane 라우트 `/v1/extension/llm-result` → `runtime.submit(reqId, ...)` → Promise 해소 → 서비스가 결과를 받음.

## 새 AI 기능 추가 체크리스트

확장 X 에 새로운 AI 기능 Y 를 추가한다고 가정.

1. **서비스 작성**: `electron/services/<x>-<y>.service.ts` — 의존성으로 `LlmCliRepository` 만 받는다. 내부에서 prompt 를 만들고 `llm.runText(prompt, { model })` 호출. claude 가 반환할 형식(마크다운/JSON/...)을 prompt 가 강제하도록 작성.
2. **prompt 작성 규칙**:
   - 결과 형식을 명시적으로 지정 (마크다운 본문만 / JSON 한 줄 등).
   - "코드 펜스로 감싸지 마세요" 같이 모델이 자주 어기는 항목 명시.
   - JSON 결과면 호출자 측에 `parseSuggestResponse` 같은 견고한 파서 두기 (모델이 코드 펜스 둘러도 처리).
   - 데이터 사이즈가 크면 prompt 본문에 JSON 인라인 — 외부 첨부 금지.
3. **IPC handler/contract** 평소대로 추가 (`electron/contracts/<x>-<y>.ts`, `electron/ipc/<x>-<y>.handler.ts`).
4. **ipc/index.ts wiring**: 서비스 인스턴스화 시 `jiraLlmRepo`(또는 그 확장의 `TerminalLlmRepository` 인스턴스) 를 주입. **새 확장이라면** 그 확장 id 로 새 `TerminalLlmRepository` 를 만든다:
   ```ts
   const myExtLlmRepo = new TerminalLlmRepository(
     'workos.my-ext',
     terminalService,
     workspaceService,
     extensionService,
     mcpService,
     extensionLlmRuntime,   // ← 싱글톤 재사용
   );
   ```
   `ExtensionLlmRuntime` 은 앱 전체에 1개. 모든 확장이 같은 인스턴스를 공유한다.
5. **렌더러 호출**: 서비스 호출 측 (mutation 등) 그대로. 결과 string 을 평소처럼 받아 처리.
6. **secret env 가 필요한 CLI 호출이면**: 확장 manifest 의 `contributes.settings.schema` 에 `type: 'secret'` 필드 선언만 해두면 자동으로 `EXT_<UPPER>` env 로 PTY/child 에 주입됨. host 코드 추가 불필요.

## 검수 항목 (반드시 확인)

### 서비스 (`electron/services/<x>-<y>.service.ts`)

- [ ] `LlmCliRepository` 인터페이스만 의존 — `TerminalLlmRepository` 구상 타입 import 금지.
- [ ] prompt 가 외부 첨부 의존 없이 self-contained (이슈 JSON 등을 인라인).
- [ ] 결과 형식이 prompt 에서 명시적으로 강제됨.
- [ ] JSON 형식이면 견고한 파서 (코드 펜스 허용 등).
- [ ] 호출 결과(string)를 그대로 또는 최소 변환 후 반환. 추가 LLM 호출 체이닝 금지.

### TerminalLlmRepository wiring (`electron/ipc/index.ts`)

- [ ] 확장 id 가 manifest 의 `id` 와 정확히 일치 (예: `'workos.jira'`).
- [ ] `extensionLlmRuntime` 은 모든 `TerminalLlmRepository` 인스턴스 사이에서 공유.
- [ ] `mcpService` 가 주입됐는지 (필수 — `.mcp.json` 시드용).

### 사용자 가시성

- [ ] 호출 시 확장 activity view + AI Terminal 패널이 자동으로 열린다 (`extension:openPanel`).
- [ ] 사용자가 패널을 닫아도 PTY 세션은 살아있어 작업이 끊기지 않는다.
- [ ] 동일 확장에서 다음 AI 호출이 와도 같은 세션이 재사용된다 (`ensureExtensionSession`).
- [ ] AI 작업 중 사용자가 다른 view 로 이동해도 PTY 와 결과 회수에 영향 없다.

### 보안 / 격리

- [ ] cwd 가 `{userData}/default-workspace/extensions/<extensionId>/` — 절대 사용자 워크스페이스가 아니어야.
- [ ] 다른 확장의 sub-cwd 에 접근하지 않는다.
- [ ] secret 값이 prompt 본문에 들어가지 않는다 (env 로만 노출).
- [ ] `terminal:exit` 이벤트가 dispatch 될 때 `ownerExtensionId` 가 본인 id 인 hook 만 매칭됨.

### 파일 위생

- [ ] prompt 파일이 30초 안에 삭제된다 (`scheduleUnlink`).
- [ ] 출력 파일 같은 임시물을 만들지 않는다 (결과는 MCP 도구 콜백으로만).
- [ ] `.workos-llm/` 하위에만 임시물 — 다른 폴더 더럽히지 않는다.

### MCP tool / runtime

- [ ] `workos_extension_llm_result` 가 카탈로그 (`MCP_TOOLS`) + 스튜디오 서버 (`workos-mcp-server.mjs`) 양쪽에 있다. **둘 중 하나만 수정하면 안 됨.**
- [ ] MCP 서버를 수정했으면 `npm run build:mcp` 로 번들 재빌드.
- [ ] `requestId` 가 nonce 로 prompt 푸터에 정확히 들어간다.
- [ ] timeout 이 작업 특성에 맞게 설정됨 (리포트 생성처럼 긴 작업은 기본 10분).
- [ ] 같은 `requestId` 로 두 번 register 호출 시 throw 한다 (안전장치).

## 잘 빠지는 함정

### 1. PTY 가 입력 명령을 echo 한다
PTY 는 사용자가 친 명령을 그대로 stdout 으로 다시 출력한다. **마커 문자열을 PTY 입력에 넣고 stdout 에서 그 마커를 찾는 패턴은 금지** — claude 가 실행되기도 전에 echo 에서 마커가 검출돼버린다. 이래서 MCP 도구 콜백을 쓴다.

### 2. cwd 가 안 맞으면 `.mcp.json` 못 찾는다
claude code CLI 는 spawn 된 cwd 에서 `.mcp.json` 을 읽는다. **반드시 확장 sub-cwd 에서 spawn** + **그 sub-cwd 에 `.mcp.json` 이 미리 시드**. `mcpService.setupAt(extensionCwd, SYSTEM_DEFAULT_WORKSPACE_ID, false)` 가 둘 다 처리.

### 3. workspaceId 헤더 혼동
control plane 은 `x-workos-workspace` 헤더를 본다. 확장 LLM 콜백의 `workspaceId` 는 `SYSTEM_DEFAULT_WORKSPACE_ID` 다 — 사용자 워크스페이스가 아님. `/v1/extension/llm-result` 라우트는 workspaceId 를 무시하고 `requestId` 로만 라우팅하므로 신경 안 써도 되지만, 다른 워크스페이스-scoped 도구 (workos_taskitem_*) 와 동일 endpoint 를 공유하면 혼선이 생길 수 있다.

### 4. `useExtensionList` 가 항상 마운트돼 있어야 한다
패널 자동 오픈 구독 effect 가 `useExtensionList` 안에 있다. `ActivityBar` 에서 이 훅을 호출하니 사실상 항상 마운트 — `ActivityBar` 를 제거하거나 lazy mount 로 바꾸면 자동 오픈이 깨진다.

### 5. PTY 세션 dispose 시점
사용자가 패널의 ✕ 로 터미널을 닫으면 `terminalApi.dispose()` 가 호출돼 PTY 가 죽는다. **AI 호출이 진행 중이라면 dispose 직후 timeout 까지 기다리다 reject** — UI 에는 "claude 작업이 ... 결과를 제출하지 않았습니다" 로 나타난다. 사용자에게 "AI 작업 중에는 터미널을 닫지 마세요" 안내가 필요할 수도 있다.

### 6. claude CLI 미설치
`mcpService.isReady()` 는 control plane 만 본다. claude CLI 가 PATH 에 없으면 PTY 에 "command not found" 가 뜨고 claude 가 시작도 못 한 채 timeout 만 발생한다. UI 에 친절한 안내는 별도 처리.

### 7. 동시 호출
같은 확장에서 동시에 2번 AI 호출하면 같은 PTY 세션에서 두 명령이 연속 실행된다 (`ensureExtensionSession` 재사용). claude 가 첫 작업을 마치기 전에 두 번째 명령이 PTY 에 쌓일 수 있다. 동시 호출이 필요한 기능이라면 서비스 단에서 mutex 를 두거나 별도 세션을 만들도록 확장 필요.

## 빠른 참조 — 파일 위치

| 책임 | 파일 |
|---|---|
| LLM repo (확장 PTY 기반) | `electron/repositories/terminal-llm.repo.ts` |
| Pending request 트래커 | `electron/services/extension-llm-runtime.ts` |
| PTY 세션 ensure / inject | `electron/services/terminal.service.ts` (`ensureExtensionSession`, `appendSessionData`) |
| 확장 cwd 해석 / 시드 | `electron/services/workspace.service.ts` (`resolveExtensionCwd`) |
| `.mcp.json` 시드 | `electron/services/mcp.service.ts` (`setupAt`) |
| MCP 도구 카탈로그 | `electron/contracts/mcp.ts` (`MCP_TOOLS`, `workos_extension_llm_result`) |
| MCP 도구 스튜디오 정의 | `electron/mcp/workos-mcp-server.mjs` |
| 컨트롤 플레인 라우트 | `electron/ipc/index.ts` (`/v1/extension/llm-result`) |
| 패널 자동 오픈 이벤트 채널 | `electron/contracts/channels.ts` (`extension:openPanel`) |
| 렌더러 자동 오픈 구독 | `src/business/extension/use-extensions.ts` |
| 확장 터미널 패널 UI | `src/presentation/features/extensions/ExtensionTerminalPanel.tsx` |
| 확장 터미널 list 훅 | `src/business/terminal/use-extension-terminal-list.ts` |
| 확장 UI 상태 | `src/business/extension/extension-store.ts` (`terminalOpenByExtension`, `activeTerminalIdByExtension`) |

## 관련 스킬

- `extensions` — 확장 시스템 전반 (manifest, view, settings, hook). AI 기능을 붙이기 전에 먼저 본다.
- `ipc-service` — 새 서비스 추가 시 main 측 패턴.
- `ipc-handler` — 새 IPC 채널 추가 시.
- `business-layer` / `server-state-layer` — renderer 호출 측 작성 시.
