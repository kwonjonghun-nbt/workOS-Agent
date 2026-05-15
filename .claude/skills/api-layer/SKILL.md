---
name: api-layer
description: workOS-Agent의 API 레이어(src/api/) 개발 및 검수. IPC 호출 래퍼를 만들거나 수정/리뷰할 때, "api 레이어", "ipc 호출", "window.electronAPI" 키워드가 나오거나 src/api/** 파일을 다룰 때 사용한다.
---

# API Layer Skill — src/api/

## 역할
Electron preload 가 노출한 `window.electronAPI.*` 를 호출하는 **얇은 IPC 래퍼**. 도메인별 함수와 DTO 타입을 제공한다.

## 개발 원칙

1. **순수 함수 + 타입만.** React, react-query, 비즈니스 로직, presentation 의존 절대 금지.
2. **함수 시그니처**: `async (request: Req) => Promise<Res>`. 입력/출력은 JSON 직렬화 가능해야 함.
3. **에러 정규화**: 모든 IPC 에러를 도메인 에러 타입으로 변환. `try/catch` 후 `ApiError` 같은 정의된 형태로 throw.
4. **DTO 는 이 레이어가 소유**한다. 비즈니스 도메인 모델과 분리. 매핑은 business 레이어가 수행.
5. **side effect 금지**: 캐싱, 토스트, 로깅(주입 가능한 logger 만), navigation 등 일체 없음.
6. 파일 구조: `src/api/<domain>/<verb>.ts` 또는 `src/api/<domain>/index.ts` 로 모음. `src/api/types.ts` 에 공통 에러/응답 래퍼.

## 금지 사항
- ❌ `useQuery`, `useMutation`, `useState` 등 React 훅 import
- ❌ `src/business/**`, `src/server-state/**`, `src/presentation/**` import
- ❌ `electron/**` 직접 import (반드시 `window.electronAPI` 경유)
- ❌ 컴포넌트, JSX
- ❌ 전역 상태 변경

## 검수 체크리스트
- [ ] React/react-query import 가 없는가
- [ ] 모든 함수가 async + 명시적 Req/Res 타입을 가지는가
- [ ] IPC 호출 결과의 에러가 정규화되어 throw 되는가
- [ ] DTO 가 비즈니스 모델로 직접 매핑되지 않고 그대로 반환되는가
- [ ] 다른 레이어 디렉토리 import 가 없는가 (`grep -r "from '\.\./business\|server-state\|presentation'"` 결과 0)
- [ ] `window.electronAPI` 외 Electron 접근 경로가 없는가

## 검수 명령
```bash
# 금지 import 검사
grep -rE "from '(\.\./)*(business|server-state|presentation)" src/api/ && echo "VIOLATION" || echo "OK"
grep -rE "react-query|@tanstack/react-query|from 'react'" src/api/ && echo "VIOLATION" || echo "OK"
grep -rE "from 'electron'" src/api/ && echo "VIOLATION" || echo "OK"
```
