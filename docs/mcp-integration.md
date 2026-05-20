# MCP 통합 — Claude CLI ↔ workOS-Agent 양방향 통신

## 1. 문제

기본 흐름([core-flow.md](./core-flow.md))은 워크OS → Claude 한 방향 푸시는 잘 되지만, 반대 방향(Claude → 워크OS의 상태/결과 보고)이 약하다.

- TaskItem 실행 시 status='running' 까지만 표시되고, 완료/실패는 사용자가 수동으로 갱신.
- 분해/워크플로 생성은 Claude 가 디스크에 JSON 을 쓰고 사용자가 "가져오기" 버튼을 눌러야 반영.

## 2. 해결 — workOS-Agent 가 MCP 서버를 노출

`workos-agent` 라는 stdio MCP 서버를 워크스페이스 `.mcp.json` 에 등록하고, Claude CLI 가 띄운 서버 프로세스가 localhost HTTP 컨트롤 플레인을 통해 Electron 메인에 콜백한다.

```
[Claude CLI]
   │ stdio
   ▼
[workos-agent MCP server]  ← spawned per session by Claude
   │ HTTP localhost:<port> + Bearer
   ▼
[Electron main: McpControlPlane]
   │ in-process
   ▼
[WorkOSService → repository → IPC push events]
```

## 3. 컴포넌트

| 파일 | 역할 |
|------|------|
| `electron/mcp/workos-mcp-server.mjs` | stdio MCP 서버 본체. SDK `@modelcontextprotocol/sdk` 기반. 사이드카에서 port/token/workspaceId 를 읽어 콜백. |
| `electron/infra/mcp-control-plane.ts` | 메인 프로세스가 부팅 시 띄우는 127.0.0.1 HTTP 서버. Bearer 토큰 검증. |
| `electron/services/mcp.service.ts` | `.mcp.json` 작성/갱신, 사이드카(`.mcp-session.json`) 갱신, .gitignore 추가. |
| `electron/contracts/mcp.ts` | IPC 채널/스키마 + 노출 도구 목록(MCP_TOOLS). |
| `electron/ipc/mcp.handler.ts` | 렌더러용 IPC 핸들러 (status/setup/listTools). |
| `electron/ipc/index.ts` | 컨트롤 플레인을 도메인 서비스에 바인딩, 스크립트 install. |
| `src/api/mcp/*`, `src/server-state/mcp/*` | 렌더러 API + react-query 옵션. |
| `src/presentation/features/workOS/McpStatusChip.tsx` | 상단 상태/설정 UI. |

## 4. 노출되는 MCP 도구

| 도구 | 동사 | 매핑 |
|------|------|------|
| `workos_taskitem_get` | TaskItem 메타 조회 | `WorkOSService.mcpGetTaskItem` |
| `workos_taskitem_progress` | 진행 로그 한 줄 push | `mcpProgress` → `eventBus(mcpEvents.progress)` |
| `workos_taskitem_complete` | 완료 + output 저장 | `mcpComplete` (+ task 상태 롤업) |
| `workos_taskitem_fail` | 실패 + error 저장 | `mcpFail` |
| `workos_task_context_get` | 부모 Task + Workflow + 형제 | `mcpTaskContext` |
| `workos_decomposition_submit` | 분해 결과 직접 제출 | `mcpSubmitDecomposition` (파일 fallback 불필요) |
| `workos_workflow_draft_submit` | 워크플로 드래프트 제출 | `mcpSubmitWorkflowDraft` |
| `workos_catalog_list` | agents/skills 카탈로그 | `WorkOSService.catalog` |
| `workos_notify` | UI 토스트 푸시 | `eventBus(mcpEvents.toast)` |

## 5. 자동 설정 동작

1. Electron 부팅 시 컨트롤 플레인이 임의 포트에서 listen + 임의 bearer 토큰 생성.
2. MCP 서버 스크립트 본체는 `app.getPath('userData')/mcp/workos-mcp-server.mjs` 로 install (SDK import 경로를 절대경로로 재작성해 packaging 환경에서도 동작).
3. 사용자가 워크스페이스에서 칩의 **"자동 설정 / 재설정"** 클릭 시:
   - `<workspace>/.mcp.json` 의 `mcpServers.workos-agent` 항목을 갱신/추가 (없으면 새로 생성, 다른 서버 항목은 보존).
   - `<workspace>/.claude/workOS/.mcp-session.json` 에 `{ workspaceId, port, token }` 기록.
   - `<workspace>/.claude/workOS/.gitignore` 에 `.mcp-session.json` 등록.

## 6. 프롬프트 헤더

`executeTaskItem`, `requestAiDecomposition`, `requestAiWorkflowGeneration` 의 프롬프트 본문 상단에 [`mcpInstructions`](../electron/services/workOS.service.ts) 헤더가 자동 주입되어, Claude 가 호출해야 할 도구와 인자(taskItemId / taskId / draftId)를 명시한다.

## 7. 보안 노트

- 컨트롤 플레인은 `127.0.0.1` 만 bind. 외부 인터페이스에는 노출되지 않음.
- 모든 요청에 `Authorization: Bearer <token>` + `X-WorkOS-Workspace: <id>` 필수.
- 토큰은 매 앱 실행마다 회전. 사이드카에 평문 저장되므로 .gitignore 자동 추가.
