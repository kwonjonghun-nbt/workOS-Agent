---
name: ipc-contract
description: workOS-Agent의 IPC 채널 계약 레이어(electron/contracts/) 및 preload/BrowserWindow 보안 설정 검수. 채널명 상수, 요청/응답 타입(zod 스키마 포함), 렌더러 동기화를 다룬다. "ipc contract", "channel contract", "channels.ts", "preload", "contextBridge", "BrowserWindow security" 키워드가 나오거나 electron/contracts/** 와 electron/preload.ts, electron/main.ts 의 보안 옵션을 다룰 때 사용한다.
---

# IPC Contract Skill — electron/contracts/ + preload/security

## 역할
**Electron(서버) ↔ React(클라이언트)** 사이의 API 계약을 한 곳에 모은다. 채널명 상수, 요청/응답 타입, 검증 스키마. 그리고 preload bridge 와 BrowserWindow 의 보안 설정을 강제한다.

## 개발 원칙

### 1. 채널 계약 (electron/contracts/)
- **채널명 상수화**: `electron/contracts/channels.ts` 에 도메인 단위 객체로 모음. 매직 스트링 금지.
  ```ts
  export const CHANNELS = {
    user: { get: 'user:get', update: 'user:update' },
    file: { read: 'file:read' },
  } as const;
  ```
- **요청/응답 타입 + zod 스키마**: 도메인별 파일에 함께 정의. handler 가 schema 로 parse, 타입은 `z.infer` 로 도출.
  ```ts
  // electron/contracts/user.ts
  import { z } from 'zod';

  export const getUserRequestSchema = z.object({ id: z.string().min(1) });
  export type GetUserRequest = z.infer<typeof getUserRequestSchema>;

  export const userResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  });
  export type UserResponse = z.infer<typeof userResponseSchema>;
  ```
- **명명 컨벤션**: `<domain>:<verb>` (`user:get`, `file:read`, `agent:run`). kebab/colon 만.
- **순수 타입 + 스키마만**: contracts 는 IO/비즈니스 로직 없음. 어느 레이어든 import 가능.

### 2. 렌더러 측 동기화
- `src/api/<domain>/types.ts` 는 contracts 와 동일한 스키마를 가진다. 다음 중 한 방법으로 동기화:
  - 동일한 zod 스키마 type-only 복제 (런타임 코드 공유 금지)
  - 또는 빌드 단계에서 contracts 의 타입 선언만 복사
- 채널명 문자열은 렌더러도 contracts/channels 의 값을 복제하거나 직접 문자열 사용. 런타임 코드(클래스/함수) 공유는 금지.

### 3. preload bridge (electron/preload.ts)
- `contextBridge.exposeInMainWorld('electronAPI', { ... })` 로 채널을 **함수 단위로 좁혀** 노출. `ipcRenderer` 자체 노출 금지.
- preload 는 비즈니스 로직 없음 — `ipcRenderer.invoke(CHANNELS.x.y, payload)` 한 줄짜리 함수만.

### 4. 보안 설정 (electron/main.ts BrowserWindow)
- 필수: `contextIsolation: true`, `nodeIntegration: false`
- 권장: `sandbox: true`, `webSecurity: true`
- 금지: `@electron/remote`, `enableRemoteModule`

## 금지 사항
- ❌ contracts 파일이 `electron`, `fs`, DB 등 IO 모듈 import
- ❌ contracts 가 service/repository/domain import
- ❌ 채널명 매직 스트링
- ❌ preload 에서 `ipcRenderer` 직접 노출
- ❌ `nodeIntegration: true`, `contextIsolation: false`, `@electron/remote`

## 검수 체크리스트
- [ ] 모든 채널이 `CHANNELS` 상수에 등록되어 있는가
- [ ] 각 채널의 요청/응답이 zod 스키마와 타입으로 정의되어 있는가
- [ ] contracts 가 외부 모듈 import 없이 순수한가
- [ ] preload 가 함수 단위로만 노출하는가
- [ ] BrowserWindow 옵션이 contextIsolation=true, nodeIntegration=false 인가
- [ ] 렌더러(`src/api/**`) 와 contracts 의 타입이 일치하는가

## 검수 명령
```bash
# contracts 순수성
grep -rE "from 'electron'|from 'fs'|from '(\.\./)*services|repositories|domain|ipc'" electron/contracts/ \
  && echo "VIOLATION: contracts not pure" || echo "OK"

# 채널 매직 스트링 (handler 에서)
grep -rE "ipcMain\.handle\(\s*['\"]" electron/ipc/ && echo "VIOLATION" || echo "OK"

# preload 위반
grep -E "exposeInMainWorld\([^)]*ipcRenderer\s*\)" electron/preload.ts && echo "VIOLATION" || echo "OK"

# 보안 설정
grep -E "nodeIntegration:\s*true|contextIsolation:\s*false" electron/ -r && echo "VIOLATION" || echo "OK"
grep -rE "@electron/remote|enableRemoteModule" electron/ && echo "VIOLATION" || echo "OK"
```
