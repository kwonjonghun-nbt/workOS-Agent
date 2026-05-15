---
name: ipc-contract
description: workOS-Agent의 Electron ↔ React IPC 경계 개발 및 검수. preload bridge, IPC handler, 채널 계약을 만들거나 리뷰할 때, "IPC", "preload", "contextBridge", "ipcMain", "ipcRenderer", "electron 채널" 키워드가 나오거나 electron/** 파일을 다룰 때 사용한다.
---

# IPC Contract Skill — electron/ ↔ src/api/

## 역할
Electron 메인 프로세스(서버)와 React 렌더러(클라이언트) 사이의 **API 계약**을 정의·구현. IPC 를 HTTP API 처럼 취급한다.

## 개발 원칙

1. **물리적 분리**: `electron/**` 와 `src/**` 는 서로 import 하지 않는다. 공유는 타입 선언과 채널 이름 문자열뿐.
2. **채널 명명**: `<domain>:<verb>` (`user:get`, `file:read`, `agent:run`). kebab/colon 만 사용.
3. **preload 는 얇게**: `contextBridge.exposeInMainWorld('electronAPI', { ... })` 로 채널을 함수로 노출만. **비즈니스 로직 금지**.
4. **요청/응답 직렬화 가능**: 함수, 클래스 인스턴스, Symbol, Date(원시화 권장) 흘려보내지 않는다.
5. **에러 정규화**: 메인에서 throw 한 에러는 `{ code, message }` 형태의 JSON 으로 반환하거나 ipc 의 reject 로 전파. 렌더러의 api 레이어가 이를 도메인 에러로 변환.
6. **타입 동기화**: `electron/ipc/<domain>.types.ts` 와 `src/api/<domain>/types.ts` 가 동일 스키마를 가져야 한다. 둘 다 type-only 파일로 유지하고, 한쪽 변경 시 다른 쪽도 즉시 업데이트.
7. **보안 기본값**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox` 권장. `BrowserWindow` 옵션에서 위반 금지.

## 금지 사항
- ❌ `electron/**` 에서 `src/**` import (또는 그 반대)
- ❌ preload 에서 `ipcRenderer` 를 그대로 `exposeInMainWorld` 로 전달 (개별 함수로 좁혀서 노출)
- ❌ `nodeIntegration: true`, `contextIsolation: false`
- ❌ `remote` 모듈 사용 (deprecated)
- ❌ 채널 이름 매직 스트링 — 상수로 관리

## 검수 체크리스트
- [ ] `electron/**` 코드가 `src/**` 를 import 하지 않는가
- [ ] preload 가 ipcRenderer 를 그대로 노출하지 않는가
- [ ] 모든 채널이 `<domain>:<verb>` 컨벤션을 따르는가
- [ ] BrowserWindow 옵션이 contextIsolation=true, nodeIntegration=false 인가
- [ ] 요청/응답 페이로드가 JSON 직렬화 가능한가
- [ ] 메인의 에러가 정규화된 형태로 렌더러에 전달되는가
- [ ] 채널 타입이 양쪽에서 일치하는가

## 검수 명령
```bash
# electron 에서 src 침범 검사
grep -rE "from '(\.\./)*src/" electron/ && echo "VIOLATION" || echo "OK"
# src 에서 electron 직접 import 검사
grep -rE "from '(\.\./)*electron/" src/ && echo "VIOLATION" || echo "OK"
# 보안 설정 확인
grep -E "nodeIntegration:\s*true|contextIsolation:\s*false" electron/ -r && echo "VIOLATION" || echo "OK"
```
