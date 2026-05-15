---
name: ipc-domain
description: workOS-Agent의 Electron Domain 레이어(electron/domain/) 개발 및 검수. 메인 프로세스의 순수 도메인 모델·엔티티·값 객체·도메인 규칙을 다룬다. "domain", "도메인 모델", "엔티티", "value object", "도메인 규칙" 키워드가 나오거나 electron/domain/** 파일을 다룰 때 사용한다.
---

# IPC Domain Skill — electron/domain/

## 역할
메인 프로세스의 **순수 도메인 모델과 규칙.** 프레임워크/IO 무관, 순수 TypeScript. 단위 테스트로 격리 실행 가능해야 한다.

## 개발 원칙

1. **순수성**: `electron`, `fs`, DB 클라이언트, HTTP 클라이언트 import 금지. side effect 없음.
2. **불변성 권장**: 변경은 새 인스턴스 반환 (`user.rename(name) → User`).
3. **도메인 규칙은 여기**: 이름 유효성, 상태 전이, 금액 계산 등 비즈니스 불변식.
4. **자체 검증**: 생성자/팩토리에서 invariant 검사. `User.create({...})` 가 잘못된 값이면 `InvalidDomainError` throw.
5. **row ↔ domain 매퍼**: `User.fromRow(row)`, `user.toRow()` 같은 변환을 도메인이 알지만, row 의 구체 스키마 의존은 repository 와 협의된 경계 내에서만. 가능하면 repository 가 매핑하고 domain 은 받는 형태가 더 깔끔.
6. **service/repository 에서 import 가능**, 반대 방향은 금지.

## 파일 패턴
```
electron/domain/
├── user.ts              # User 엔티티
├── user.errors.ts       # 도메인 에러
└── value-objects/
    └── email.ts
```

```ts
// electron/domain/user.ts
import { InvalidDomainError } from '@/electron/infra/error';

export class User {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
  ) {}

  static create(input: { id: string; name: string; email: string }): User {
    if (!input.name.trim()) throw new InvalidDomainError('name 은 비어있을 수 없습니다');
    return new User(input.id, input.name.trim(), input.email);
  }

  rename(name: string): User {
    return User.create({ id: this.id, name, email: this.email });
  }
}
```

## 금지 사항
- ❌ `electron`, `fs`, `path`, DB/HTTP 클라이언트 등 IO 모듈 import
- ❌ `electron/services|repositories|ipc/**` import (역방향)
- ❌ `src/**` import
- ❌ 비동기 IO 함수 (async I/O 는 service/repository 의 책임)
- ❌ 전역 상태 변경

## 검수 체크리스트
- [ ] 외부 모듈 / IO import 가 없는가
- [ ] 모든 생성/변경이 invariant 검사를 거치는가
- [ ] 변경이 불변성을 지키는가 (in-place mutation 지양)
- [ ] 도메인 규칙이 service 가 아닌 이 레이어에 있는가
- [ ] 순수 함수 단위 테스트가 가능한가

## 검수 명령
```bash
grep -rE "from 'electron'|from 'fs'|from 'fs/promises'|from 'path'" electron/domain/ && echo "VIOLATION" || echo "OK"
grep -rE "from '(\.\./)*(services|repositories|ipc)" electron/domain/ && echo "VIOLATION" || echo "OK"
grep -rE "from '(\.\./)*src/" electron/domain/ && echo "VIOLATION" || echo "OK"
```
