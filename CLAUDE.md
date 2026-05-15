# workOS-Agent — Project Rules

## 아키텍처 원칙

### 1. Electron ↔ React 경계 (물리적 분리)

- **IPC 통신은 API 통신으로 취급한다.** Electron 메인 프로세스는 "백엔드 서버", React 렌더러는 "프론트엔드 클라이언트"로 본다.
- 두 앱은 **물리적으로 로직이 섞이지 않는다.** 비즈니스 로직, 도메인 타입, 유틸을 공유하기 위해 import 경계를 넘지 않는다.
- 통신은 **반드시 preload 의 contextBridge 를 거친 IPC 채널**로만 이뤄진다. `nodeIntegration`, `remote` 모듈, 직접 require 는 금지.
- 공유가 필요한 것은 **JSON 직렬화 가능한 데이터 + 채널 계약(타입 선언)** 뿐이다. 클래스 인스턴스/함수/심볼은 IPC 로 흘려보내지 않는다.

```
electron/        ← "서버" — main, preload, IPC handlers, native I/O
src/             ← "클라이언트" — React 앱, 절대 electron/ 을 import 하지 않는다
```

React 코드에서 Electron API 는 오직 `window.electronAPI.*` (preload 노출분) 로만 접근한다.

### 2. React 앱 레이어 구조

React 앱은 4개 레이어로 분리하며, **각 레이어는 인접한 상위 레이어만 호출**한다. 하위 레이어가 상위 레이어를 import 하거나, 레이어를 건너뛰어 직접 참조하는 것은 금지.

```
Presentation  (components, hooks-for-UI)
     ↓ 호출
Business      (use-cases, domain rules)
     ↓ 호출
Server State  (react-query: useQuery / useMutation, queryKeys)
     ↓ 호출
API           (window.electronAPI 래퍼, request/response 타입)
```

**디렉토리 매핑**

```
src/
├── api/           # API 레이어 — IPC 호출 래퍼, 채널별 함수, DTO 타입
├── server-state/  # react-query — queries, mutations, queryKeys
├── business/      # 비즈니스 로직 — 도메인 모델, use-case, 검증/계산
├── presentation/  # UI — components, pages, presentation hooks
└── shared/        # 레이어 무관 공용물 (타입, 유틸) — 단방향성 유지
```

**레이어별 책임**

- **API**: `window.electronAPI` 호출, 직렬화/역직렬화, 에러 정규화. React/state 의존 없음.
- **Server State**: react-query. **queryKey factory + `queryOptions()` / `mutationOptions()` 패턴**으로 옵션을 export 하고, 커스텀 훅 래퍼를 만들지 않는다. 호출 측은 `useQuery` / `useSuspenseQuery` / `useMutation` 에 옵션을 그대로 전달. API 레이어만 호출.
- **Business**: 도메인 객체, 비즈니스 규칙, 여러 쿼리/뮤테이션 조합 use-case. React 컴포넌트 미사용.
- **Presentation**: JSX, 스타일, UI 상태(useState), 폼. Business 또는 Server State 훅만 호출.

**금지 사항**

- Presentation → API 직접 호출 ❌ (반드시 Server State 또는 Business 를 경유)
- Business → Presentation import ❌
- Server State → Business import ❌
- API → React/react-query import ❌
- 어느 레이어든 → `electron/*` 직접 import ❌

### 3. IPC 채널 계약

- 채널 이름은 도메인 단위 (`user:get`, `file:read`) 로 명명한다.
- 요청/응답 타입은 `src/api/` 와 `electron/` 양쪽에서 동일한 스키마로 유지한다. (필요 시 `shared/ipc-contract.ts` 와 같이 타입-only 파일을 양쪽이 각자 복제하거나, 빌드 단계에서 동기화한다 — 런타임 코드는 공유 금지)
- preload 는 채널을 노출만 하고 비즈니스 로직을 두지 않는다.

## 레이어별 스킬

각 레이어 작업 시 해당 스킬을 호출해 원칙·검수 체크리스트를 따른다.

- `/api-layer` — `src/api/**`
- `/server-state-layer` — `src/server-state/**`
- `/business-layer` — `src/business/**`
- `/presentation-layer` — `src/presentation/**`
- `/ipc-contract` — `electron/**` 와 IPC 경계
- `/form-layer` — 폼 (react-hook-form + zod, API 스펙과 분리)

레이어 파일을 편집하거나 리뷰할 때 자동으로 매칭되도록 description 트리거를 설정해두었다.
