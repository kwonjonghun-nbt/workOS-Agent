---
name: ipc-handler
description: workOS-Agent의 Electron IPC Handler 레이어(electron/ipc/) 개발 및 검수. ipcMain.handle 등록, 입력 검증, service 호출, 응답/에러 정규화를 다룬다. "ipcMain", "ipcMain.handle", "ipc handler", "채널 핸들러" 키워드가 나오거나 electron/ipc/** 파일을 다룰 때 사용한다.
---

# IPC Handler Skill — electron/ipc/

## 역할
IPC 채널의 **transport 어댑터**. 렌더러의 요청을 받아 입력을 검증하고, service 를 호출한 뒤, 응답을 직렬화하여 돌려준다. 비즈니스 로직은 일체 두지 않는다.

## 개발 원칙

1. **얇게 유지**: handler 는 "전화 교환원" — 검증 → service 호출 → 정규화된 응답 반환.
2. **채널 등록**: `electron/contracts/` 에 정의된 채널명 상수를 import 해서 `ipcMain.handle(CHANNELS.user.get, ...)` 형태로 등록. 매직 스트링 금지.
3. **입력 검증**: zod 등으로 payload 를 schema parse. 실패 시 `ApiError('VALIDATION', ...)` 으로 throw.
4. **에러 정규화**: service/repository 에서 올라온 에러를 `{ code, message, details? }` 형태로 변환하여 throw — 렌더러의 api 레이어가 이를 도메인 에러로 매핑.
5. **service 만 호출**: repository / domain 직접 import 금지. 반드시 service 를 경유.
6. **응답 직렬화**: domain 모델을 그대로 반환하지 않고, contracts 의 response 타입에 맞게 매핑.

## 파일 패턴
```
electron/ipc/
├── index.ts              # registerIpcHandlers(app) — 앱 부팅 시 한 번 호출
├── user.handler.ts
└── file.handler.ts
```

```ts
// electron/ipc/user.handler.ts
import { ipcMain } from 'electron';
import { CHANNELS } from '@/electron/contracts/channels';
import { getUserRequestSchema } from '@/electron/contracts/user';
import { userService } from '@/electron/services/user.service';
import { toApiError } from '@/electron/infra/error';

export function registerUserHandlers() {
  ipcMain.handle(CHANNELS.user.get, async (_e, raw) => {
    try {
      const { id } = getUserRequestSchema.parse(raw);
      const user = await userService.getById(id);
      return { id: user.id, name: user.name, email: user.email };
    } catch (err) {
      throw toApiError(err);
    }
  });
}
```

## 금지 사항
- ❌ 비즈니스 로직 / 도메인 규칙 (service 로 이동)
- ❌ `repositories/**`, `domain/**` 직접 import (service 만 호출)
- ❌ 채널명 매직 스트링 (`'user:get'` 직접 입력)
- ❌ 검증되지 않은 payload 를 service 에 전달
- ❌ 정규화되지 않은 raw 에러 throw (스택/내부 경로 노출 위험)
- ❌ `src/**` (렌더러 코드) import

## 검수 체크리스트
- [ ] handler 내부에 비즈니스 로직이 없는가 (5~15 줄 권장)
- [ ] 모든 채널이 `contracts/channels.ts` 의 상수를 사용하는가
- [ ] 모든 payload 가 zod 등으로 검증되는가
- [ ] service 외 다른 레이어 import 가 없는가
- [ ] 에러가 `toApiError` 같은 정규화 함수를 거치는가
- [ ] 응답이 도메인 모델이 아닌 contracts 의 response 타입에 맞는가

## 검수 명령
```bash
grep -rE "from '(\.\./)*repositories|from '(\.\./)*domain" electron/ipc/ && echo "VIOLATION" || echo "OK"
grep -rE "from '(\.\./)*src/" electron/ipc/ && echo "VIOLATION" || echo "OK"
grep -rE "ipcMain\.handle\(\s*['\"]" electron/ipc/ && echo "VIOLATION: magic channel string" || echo "OK"
```
