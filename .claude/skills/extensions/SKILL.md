---
name: extensions
description: workOS-Agent의 확장 프로그램(Extensions) 시스템 개발 및 검수. 새 확장을 추가하거나, 카탈로그/manifest/이벤트 hook/설정 폼/액티비티 바를 수정·리뷰할 때 사용한다. "확장", "extension", "manifest", "액티비티 바", "activity bar", "event hook", "확장프로그램" 키워드가 나오거나 `electron/builtin-extensions/**`, `electron/contracts/extension.ts`, `electron/services/extension.service.ts`, `electron/repositories/extension.repo.ts`, `electron/ipc/extension.handler.ts`, `src/api/extension/**`, `src/server-state/extension/**`, `src/business/extension/**`, `src/presentation/features/extensions/**` 파일을 다룰 때 사용한다.
---

# Extensions Skill — 확장 프로그램 시스템

## 핵심 원칙 (이게 깨지면 시스템이 깨진다)

1. **확장은 1st-party 번들 모듈이다.** GitHub/URL 등 외부 소스에서 가져오는 코드는 절대 추가하지 않는다. 카탈로그는 컴파일 타임에 고정.
2. **확장은 선언형이다.** manifest 외부의 JS 실행 경로(`eval`, `vm`, dynamic require, fetched code execution) 를 도입하지 않는다. 새로운 능력은 manifest 스펙 + host 측 디스패처로 표현한다.
3. **manifest 는 zod 로 검증된 후에만 신뢰한다.** 부팅 시 `parseManifest` 가 throw 하면 카탈로그 전체 부팅 실패가 정상 동작.
4. **사용자 상태는 SSOT 가 main 프로세스다.** 변경은 IPC → service → repo → broadcast 순환을 거치며, 렌더러는 push event(`extension:changed`) 로만 동기화한다.
5. **모든 확장은 기본 꺼짐.** 새 확장 추가 시 자동 활성화 금지. 사용자가 명시적으로 켜야 한다.

## 아키텍처 한눈

```
electron/
├── contracts/extension.ts       ① zod 스키마 + 채널 타입 (SSOT for shape)
├── contracts/channels.ts        ② extension:* 채널 이름
├── domain/extension.ts          ③ 순수 함수: parseManifest, hookMatches,
│                                   renderTemplate, validateSettingValue,
│                                   defaultSettings
├── repositories/extension.repo.ts  ④ 사용자 상태만 JSON 저장
├── builtin-extensions/          ⑤ 카탈로그 (정적 import)
│   ├── index.ts                    Array<ExtensionManifest> export
│   └── <id>.manifest.ts            확장별 manifest 객체
├── services/extension.service.ts ⑥ 카탈로그 × 상태 머지, hook 디스패치
└── ipc/extension.handler.ts     ⑦ 채널 ↔ service 매핑

src/
├── api/extension/               ⑧ window.electronAPI.extension 래퍼
├── server-state/extension/      ⑨ react-query queryKey/options
├── business/extension/          ⑩ use-extension hooks + UI store
└── presentation/features/extensions/  ⑪ ActivityBar, Sidebar, Manager, Form
```

의존 방향: 위에서 아래로만, 좌에서 우로만. domain 은 무엇도 import 하지 않는다.

## 새 확장을 추가할 때

1. **`electron/builtin-extensions/<id>.manifest.ts`** 생성, manifest 객체 export.
   - `id` 는 `workos.<feature>` 네임스페이스 권장. 카탈로그 내 유일해야 함.
   - `version` 은 `X.Y.Z` 형식.
   - 기존 확장과 view `id` 가 같아도 됨 (key 는 `${extensionId}:${viewId}` 로 네임스페이싱됨).
2. **`electron/builtin-extensions/index.ts`** 의 `RAW_MANIFESTS` 배열에 import + push.
3. 앱 실행. 부팅 시 `parseManifest` 가 검증.
4. 사용자는 ⌬ Extensions 사이드바에서 토글로 활성화.

**필요 없는 것**: 채널 추가, 핸들러 추가, UI 컴포넌트 작성, 빌드 설정 변경. 모두 데이터 변경만으로 끝난다.

## 새 기능 카테고리를 추가할 때 (capability extension)

manifest 에 새로운 능력을 추가하려면:

### 새 event hook event 추가
1. `electron/contracts/extension.ts` 의 `eventHookEventSchema` 에 이벤트명 추가.
2. payload 필드를 docs/extensions.md 표에 명시.
3. 이벤트 발생 지점에서 `extensionService.dispatchEvent(eventName, payload)` 호출. **현재 sink 안에서 fire-and-forget(`void ... .catch(log)`) 으로 호출**해서 hook 실패가 호스트 lifecycle 에 영향 못 주게 한다.

### 새 action type 추가
1. `eventHookActionSchema` 에 discriminated union variant 추가.
2. `ExtensionService.executeAction` switch 에 case 추가.
3. action 이 외부 효과(파일 쓰기, 명령 실행 등)를 일으키면 **service constructor 에 의존성을 주입**하고 (e.g. `terminalService.spawn(...)`), domain 함수가 직접 부르지 않게 한다.

### 새 view body 블록 추가
1. `extensionViewBodyBlockSchema` 에 variant 추가.
2. `src/presentation/features/extensions/ExtensionsSidebar.tsx` 의 `ViewBodyBlock` 에 렌더 케이스 추가.

### 새 settings field 타입 추가
1. `settingsFieldSchema` 에 variant 추가.
2. `domain/extension.ts` 의 `validateSettingValue` switch 에 case 추가.
3. `ExtensionSettingsForm.tsx` 의 `FieldInput` 에 렌더 케이스 추가.

## 금지 사항

- ❌ 카탈로그를 **런타임에 mutate** (예: `BUILTIN_EXTENSIONS.push(...)`) — 컴파일 타임 상수.
- ❌ 외부 네트워크(`fetch`, `http`) 로 manifest 또는 코드 다운로드.
- ❌ 사용자 상태에 `manifest` 자체를 저장 (id 만 키). manifest 는 카탈로그가 SSOT.
- ❌ Service 에서 카탈로그 외 manifest 를 신뢰 (반드시 `requireManifest(id)` 경유).
- ❌ Hook action 에서 throw 한 에러가 호출자(터미널 sink 등) 까지 전파.
- ❌ 새 확장에 `enabled: true` 기본값. 도메인 `defaultSettings` 만 채우고 enabled 는 `false` 로 시작.
- ❌ 사용자 상태 저장 파일에 `enabled` 외 메타(설치 시각, 소스 등) 추가.
- ❌ `electron/builtin-extensions/<id>.manifest.ts` 를 `electron/` 외부에서 import.
- ❌ 카탈로그 entry 가 invalid 일 때 silent skip — 반드시 부팅을 실패시킨다 (`builtin-extensions/index.ts` 의 try/catch 가 그 역할).

## 검수 체크리스트

설계
- [ ] 새 확장은 카탈로그에만 등록되고 외부 fetch 가 없는가
- [ ] 새 능력은 manifest 스펙(zod 스키마) 변경 + host 디스패처 변경의 2-step 으로 표현되는가
- [ ] 임의 JS 실행 경로가 추가되지 않았는가 (`grep "new Function\|eval\|vm\.run"`)

기능
- [ ] manifest 가 부팅 시 zod 로 검증되는가 (RAW_MANIFESTS 의 모든 entry)
- [ ] 새 확장이 기본 비활성인가
- [ ] view contribute 추가 시 액티비티 바에 아이콘이 노출되는가 (활성화 후)
- [ ] 새 hook event 가 비활성 확장에서는 발화하지 않는가
- [ ] settings 변경이 다음 hook 발화에 즉시 반영되는가 (재시작 불필요)

품질
- [ ] `extension:changed` push 가 변경 후 항상 broadcast 되는가
- [ ] Repository 가 atomic write (tmp + rename) 인가
- [ ] Service 에서 도메인 함수만 호출하고 도메인이 electron/fs/네트워크 import 가 없는가
- [ ] `${...}` 템플릿이 사용자 입력으로 인한 XSS/명령 주입 위험이 없는가 (현재 toast 렌더만 가능 — 새 action 추가 시 재검토)
- [ ] docs/extensions.md 의 스펙 / 이벤트 표 / 액션 목록이 코드와 일치하는가

## 검수 명령

```bash
# 외부 fetch 금지 — extension 코드가 네트워크를 두드리지 않는지
grep -rE "fetch\(|https?://" electron/builtin-extensions/ electron/services/extension.service.ts electron/repositories/extension.repo.ts && echo "VIOLATION" || echo "OK"

# eval/dynamic code execution 금지
grep -rE "new Function|eval\(|vm\.run|require\(" electron/services/extension.service.ts electron/domain/extension.ts && echo "VIOLATION" || echo "OK"

# 카탈로그 외부에서 manifest 파일을 import 하지 않는지
grep -rE "from ['\"].*builtin-extensions" --include="*.ts" --include="*.tsx" src/ electron/ipc/ electron/services/ electron/repositories/ && echo "Check: only electron/ipc/index.ts and electron/builtin-extensions/index.ts should import"

# 사용자 상태에 manifest 가 저장되지 않는지 (id-keyed state-only)
grep -E "manifest" electron/repositories/extension.repo.ts && echo "VIOLATION: state repo must not hold manifests" || echo "OK"

# 새 확장이 기본 비활성인지 (service.list 의 fallback)
grep -n "enabled: persisted?.enabled ?? false" electron/services/extension.service.ts || echo "VIOLATION: default-enabled flipped"

# 타입체크
npx tsc -b 2>&1 | grep -v "^$" || echo "OK"
```

## 자주 하는 실수

- **manifest 파일을 JSON 으로** — 의도적으로 TS 객체로 작성한다. 타입 추론, 정적 검증, esbuild 번들링이 동시에 가능.
- **새 확장 추가 후 카탈로그 index.ts 수정 누락** — `RAW_MANIFESTS` 에 push 해야 실제 노출됨.
- **hook 발화 시 await 없이 호출** — `dispatchEvent` 는 async 인데 호출자(sink)는 동기적. `void` 와 `.catch(log)` 를 함께 사용해 에러가 사라지지 않게.
- **렌더러에서 `ExtensionManifest` 를 mutate** — UI 는 read-only. 변경은 IPC 만.
- **새 event 추가 시 docs/extensions.md 누락** — 표가 사용자 contract.

## 관련 파일 빠른 참조

| 변경하고 싶은 것 | 건드릴 파일 |
|---|---|
| 새 확장 등록 | `electron/builtin-extensions/<id>.manifest.ts` + `.../index.ts` |
| 새 hook event | `contracts/extension.ts` (스키마) + 이벤트 발생지(`ipc/index.ts` 등) + `docs/extensions.md` |
| 새 action type | `contracts/extension.ts` + `services/extension.service.ts` (executeAction) |
| 새 settings 필드 타입 | `contracts/extension.ts` + `domain/extension.ts` (validateSettingValue) + `presentation/.../ExtensionSettingsForm.tsx` (FieldInput) |
| 새 view body 블록 | `contracts/extension.ts` + `presentation/.../ExtensionsSidebar.tsx` (ViewBodyBlock) |
| 액티비티 바 모양 | `presentation/features/extensions/ActivityBar.tsx` |
| 카탈로그 UI | `presentation/features/extensions/ExtensionsManager.tsx` |
