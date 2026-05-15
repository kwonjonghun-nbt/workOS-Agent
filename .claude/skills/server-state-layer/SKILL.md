---
name: server-state-layer
description: workOS-Agent의 Server State 레이어(src/server-state/) 개발 및 검수. react-query 훅, queryKey factory, queryOptions/mutationOptions, mutation, 캐시 정책을 만들거나 리뷰할 때, "react-query", "useQuery", "useSuspenseQuery", "queryKey", "queryOptions", "mutationOptions", "server state" 키워드가 나오거나 src/server-state/** 파일을 다룰 때 사용한다.
---

# Server State Layer Skill — src/server-state/

## 역할
react-query 를 활용해 IPC 호출(API 레이어)의 **서버 상태**를 캐싱·동기화. queryKey, queryOptions, mutationOptions 를 일관된 패턴으로 관리한다.

## 개발 원칙

1. **호출 경로**: 이 레이어는 오직 `src/api/**` 만 호출. Business/Presentation 호출 금지.

2. **queryKey factory 필수**: `src/server-state/<domain>/keys.ts` 에 keyFactory 로 일원화. 인라인 매직 배열 금지.
   ```ts
   export const userKeys = {
     all: ['user'] as const,
     lists: () => [...userKeys.all, 'list'] as const,
     list: (filter: UserFilter) => [...userKeys.lists(), filter] as const,
     details: () => [...userKeys.all, 'detail'] as const,
     detail: (id: string) => [...userKeys.details(), id] as const,
   };
   ```

3. **queryOptions / mutationOptions 패턴 사용**: 커스텀 훅(`useXxxQuery`) 을 만들지 않고, `@tanstack/react-query` v5 의 `queryOptions()` / `mutationOptions()` 헬퍼로 옵션을 export 한다. **Presentation 은 `useQuery` / `useSuspenseQuery` / `useMutation` 에 이 옵션 객체를 그대로 넘겨 호출한다.**
   ```ts
   // src/server-state/user/queries.ts
   import { queryOptions } from '@tanstack/react-query';
   import { userKeys } from './keys';
   import { fetchUser } from '@/api/user';

   export const userQueries = {
     detail: (id: string) =>
       queryOptions({
         queryKey: userKeys.detail(id),
         queryFn: () => fetchUser(id),
         staleTime: 60_000,
       }),
   };
   ```
   ```ts
   // src/server-state/user/mutations.ts
   import { mutationOptions } from '@tanstack/react-query';
   import { createUser } from '@/api/user';
   import { userKeys } from './keys';

   export const userMutations = {
     create: (queryClient: QueryClient) =>
       mutationOptions({
         mutationFn: createUser,
         onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.lists() }),
       }),
   };
   ```
   ```ts
   // Presentation 사용 예
   const { data } = useSuspenseQuery(userQueries.detail(id));
   const { data } = useQuery(userQueries.detail(id));
   const { mutate } = useMutation(userMutations.create(queryClient));
   ```

4. **커스텀 훅 래핑 금지**: `useUserQuery(id)` 처럼 `useQuery` 를 한 번 더 감싸는 훅은 만들지 않는다. 옵션 팩토리만 export 하고 호출은 호출 측에서. (예외: 여러 쿼리를 묶어야 하는 경우는 business 레이어의 use-case 훅으로.)

5. **`useSuspenseQuery` 권장**: 로딩/에러 처리가 Suspense + ErrorBoundary 로 일원화되도록 가능한 경우 `useSuspenseQuery` 를 사용한다. 조건부 로딩이 필요할 때만 `useQuery` 선택.

6. **DTO 그대로 반환**: queryFn 결과를 변환하지 않는다. Domain 모델 매핑은 business 의 책임. (`select` 옵션도 단순 파생일 때만, 도메인 변환은 금지.)

7. **invalidation 명시**: mutation 의 `onSuccess` 에서 어떤 key 를 invalidate 하는지 명확히. 마법 같은 부수효과 금지.

8. **UI 의존 금지**: 토스트/네비게이션은 호출 측(Presentation) 에서 `onSuccess`/`onError` 옵션을 덮어 처리.

## 디렉토리 권장 구조
```
src/server-state/<domain>/
├── keys.ts        # queryKey factory
├── queries.ts     # queryOptions 모음
├── mutations.ts   # mutationOptions 모음
└── index.ts       # re-export
```

## 금지 사항
- ❌ `src/api/**` 외부 디렉토리 import (business, presentation 모두 금지)
- ❌ JSX, 컴포넌트, `useState` 로 UI 상태 관리
- ❌ `window.electronAPI` 직접 호출 (반드시 api 레이어 경유)
- ❌ queryKey 인라인 배열 (`['user', id]` 같은 매직 배열)
- ❌ `useUserQuery`, `useCreateUserMutation` 같은 **커스텀 훅 래퍼**
- ❌ queryFn 내부에서 도메인 모델 변환 / 비즈니스 규칙 적용
- ❌ 토스트/라우팅을 server-state 내부에서 직접 호출

## 검수 체크리스트
- [ ] api 레이어 외 다른 레이어 import 가 없는가
- [ ] queryKey 가 keyFactory 로 일원화되어 있는가 (인라인 배열 0)
- [ ] 쿼리/뮤테이션이 `queryOptions()` / `mutationOptions()` 로 export 되는가
- [ ] `useQuery` / `useSuspenseQuery` / `useMutation` 을 감싼 커스텀 훅이 없는가
- [ ] 가능한 곳에 `useSuspenseQuery` 가 우선 고려되었는가
- [ ] DTO → Domain 변환 코드가 없는가 (있다면 business 로 이동)
- [ ] 각 mutation 의 invalidation 대상이 명시적인가
- [ ] 토스트/라우팅 등 UI 부수효과가 직접 호출되지 않는가

## 검수 명령
```bash
# 레이어 위반
grep -rE "from '(\.\./)*(business|presentation)" src/server-state/ && echo "VIOLATION" || echo "OK"
grep -rE "window\.electronAPI" src/server-state/ && echo "VIOLATION" || echo "OK"

# 인라인 queryKey
grep -rE "queryKey:\s*\[['\"]" src/server-state/ && echo "INLINE KEY (use factory)" || echo "OK"

# 커스텀 훅 래퍼 금지
grep -rE "export\s+(function|const)\s+use[A-Z]\w*(Query|Mutation)\b" src/server-state/ \
  && echo "VIOLATION: custom hook wrapper — use queryOptions/mutationOptions instead" || echo "OK"

# queryOptions / mutationOptions 사용 여부 (경고용)
grep -rE "queryOptions\(|mutationOptions\(" src/server-state/ >/dev/null || echo "WARN: no queryOptions/mutationOptions found"
```
