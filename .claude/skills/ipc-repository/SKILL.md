---
name: ipc-repository
description: workOS-Agent의 Electron Repository/Adapter 레이어(electron/repositories/) 개발 및 검수. fs, sqlite, http, child_process 등 네이티브 I/O 어댑터를 다룬다. "repository", "adapter", "어댑터", "fs", "sqlite", "child_process", "native io" 키워드가 나오거나 electron/repositories/** 파일을 다룰 때 사용한다.
---

# IPC Repository Skill — electron/repositories/

## 역할
**데이터/외부 시스템 접근의 어댑터.** SQLite, 파일시스템, HTTP, child_process, OS API 등 부수효과가 있는 모든 I/O 를 이 레이어로 격리. service 는 인터페이스에 의존하고, 이 레이어가 구현을 제공한다.

## 개발 원칙

1. **인터페이스 + 구현 분리**: 같은 파일 또는 `*.repo.ts` / `*.repo.sqlite.ts` 처럼 인터페이스와 구현을 명확히. service 는 인터페이스만 import.
2. **단일 책임**: 한 repository = 한 도메인 + 한 저장소 종류. `UserRepository` 가 SQLite 와 HTTP 둘 다 만지지 않게.
3. **Domain 모델로 in/out**: raw row/JSON 을 domain 모델로 변환해 반환. service 가 raw 형태를 보지 않도록.
4. **트랜잭션/연결 풀**: 연결, 트랜잭션, 풀링은 이 레이어 또는 `infra` 에서 관리. service 는 트랜잭션 시작 메서드(`db.transaction(fn)`) 만 호출.
5. **에러 변환**: raw 에러(SQLITE_CONSTRAINT, ENOENT 등) 를 의미 있는 도메인 에러로 매핑.
6. **`electron` 모듈은 경로 가져올 때만**: `app.getPath('userData')` 등은 OK. ipcMain/BrowserWindow 같은 transport 는 금지.

## 파일 패턴
```
electron/repositories/
├── user.repo.ts          # interface + sqlite 구현
├── file.repo.ts          # fs 어댑터
└── agent.repo.ts         # http/child_process 어댑터
```

```ts
// electron/repositories/user.repo.ts
import type { User } from '@/electron/domain/user';
import { db } from '@/electron/infra/db';
import { NotFoundError } from '@/electron/infra/error';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export class SqliteUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const row = await db.get('SELECT * FROM users WHERE id = ?', id);
    return row ? User.fromRow(row) : null;
  }

  async save(user: User): Promise<void> {
    const row = user.toRow();
    await db.run(
      'INSERT INTO users (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = ?',
      row.id, row.name, row.name,
    );
  }
}
```

## 금지 사항
- ❌ `electron/services/**`, `electron/ipc/**` import (역방향)
- ❌ `src/**` import
- ❌ 비즈니스 규칙/검증 (domain 또는 service 의 책임)
- ❌ raw 에러 그대로 throw — 도메인 에러로 변환
- ❌ 여러 도메인을 한 repository 에 섞기
- ❌ `ipcMain`, `webContents` 등 transport 모듈

## 검수 체크리스트
- [ ] 인터페이스가 명시되어 있고 service 가 인터페이스에 의존하는가
- [ ] raw row/JSON 을 domain 모델로 매핑하는가
- [ ] services/ipc 디렉토리 import 가 없는가
- [ ] raw 에러가 도메인 에러로 변환되는가
- [ ] 트랜잭션 경계가 명확한가
- [ ] 한 파일이 단일 도메인 + 단일 저장소만 다루는가

## 검수 명령
```bash
grep -rE "from '(\.\./)*services|from '(\.\./)*ipc" electron/repositories/ && echo "VIOLATION" || echo "OK"
grep -rE "from '(\.\./)*src/" electron/repositories/ && echo "VIOLATION" || echo "OK"
grep -rE "ipcMain|BrowserWindow|webContents" electron/repositories/ && echo "VIOLATION" || echo "OK"
```
