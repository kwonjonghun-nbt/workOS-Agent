---
name: ipc-service
description: workOS-Agent의 Electron Service 레이어(electron/services/) 개발 및 검수. 메인 프로세스의 비즈니스 use-case, repository 조합, 도메인 규칙 적용을 담당한다. "service", "use-case", "유스케이스", "비즈니스 로직 main", "electron service" 키워드가 나오거나 electron/services/** 파일을 다룰 때 사용한다.
---

# IPC Service Skill — electron/services/

## 역할
메인 프로세스의 **비즈니스 use-case**. handler 가 호출하는 단위. 여러 repository 를 조합하고 domain 규칙을 적용해 원하는 동작을 완성한다.

## 개발 원칙

1. **호출 경로**: handler 가 호출 → service → (repository, domain). service 는 다른 service 호출 가능 (순환 금지).
2. **Repository 인터페이스 의존**: 구체 구현이 아닌 `UserRepository` 같은 인터페이스에 의존. 부트스트랩에서 주입(constructor 또는 factory).
3. **순수 TS 권장**: `electron` 모듈을 import 하지 않는다. 그래야 Node 단위 테스트로 service 만 격리 실행 가능.
4. **트랜잭션/오케스트레이션**: 여러 repository 호출을 묶거나, 외부 호출 + 로컬 저장을 함께 다루는 경우 service 가 트랜잭션 경계를 정한다.
5. **도메인 에러 throw**: `NotFoundError('User', id)`, `ConflictError(...)` 처럼 의미 있는 에러를 던진다. handler 가 이를 IPC ApiError 로 정규화.
6. **side effect 명시화**: EventBus(infra) 를 통해 push 이벤트 발행. `webContents.send` 직접 호출 금지.

## 파일 패턴
```
electron/services/
├── user.service.ts
└── file.service.ts
```

```ts
// electron/services/user.service.ts
import type { UserRepository } from '@/electron/repositories/user.repo';
import { User } from '@/electron/domain/user';
import { NotFoundError } from '@/electron/infra/error';

export class UserService {
  constructor(private readonly users: UserRepository) {}

  async getById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  async rename(id: string, name: string): Promise<User> {
    const user = await this.getById(id);
    const renamed = user.rename(name);     // 도메인 규칙은 domain 객체가
    await this.users.save(renamed);
    return renamed;
  }
}
```

## 금지 사항
- ❌ `electron` 모듈 (`ipcMain`, `BrowserWindow`, `app`, `webContents`) 직접 import
- ❌ `electron/ipc/**` import (역방향)
- ❌ Repository 구체 구현 import (인터페이스만)
- ❌ DOM/렌더러 코드 (`src/**`) import
- ❌ 채널명, IPC 응답 형태 같은 transport 관심사
- ❌ `console.*` 직접 호출 — `infra/logger` 사용

## 검수 체크리스트
- [ ] service 가 인터페이스에 의존하는가 (구체 repo 직접 import 금지)
- [ ] `electron` 모듈 import 가 없는가
- [ ] handler/ipc 디렉토리 import 가 없는가
- [ ] 도메인 규칙이 service 가 아닌 domain 객체/함수로 위임되어 있는가
- [ ] push 이벤트가 EventBus 를 거치는가
- [ ] 도메인 에러가 의미 있는 타입으로 throw 되는가

## 검수 명령
```bash
grep -rE "from 'electron'" electron/services/ && echo "VIOLATION" || echo "OK"
grep -rE "from '(\.\./)*ipc(/|')" electron/services/ && echo "VIOLATION" || echo "OK"
grep -rE "from '(\.\./)*src/" electron/services/ && echo "VIOLATION" || echo "OK"
grep -rE "webContents\.send" electron/services/ && echo "VIOLATION: use EventBus" || echo "OK"
```
