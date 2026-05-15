---
name: form-layer
description: workOS-Agent에서 폼(form) UI를 만들거나 검수할 때 사용. react-hook-form + zod 기반, 폼 스키마와 API 타입의 분리/매핑 원칙을 강제한다. "form", "폼", "react-hook-form", "useForm", "zod", "validation", "defaultValues", "입력 폼" 키워드가 나오거나 폼 컴포넌트를 다룰 때 사용한다.
---

# Form Skill — react-hook-form + zod

## 핵심 원칙

**Form 은 사용자 입력 도구일 뿐이다. API 스펙과 1:1 일치해서는 안 된다.**

- Form 의 책임: `defaultValues` 를 받아 사용자 입력을 수집하고, validation 을 거쳐 `output` 을 내보내는 것.
- API 와의 연결은 **양방향 매퍼**가 담당한다.
  - **`apiToForm(apiData) → FormValues`**: API 응답을 form 의 defaultValues 로 변환.
  - **`formToApi(formOutput) → ApiPayload`**: form 의 output 을 API payload 로 변환.
- 폼 컴포넌트, 폼 스키마, useForm 어디에서도 API DTO 타입을 직접 참조하지 않는다.

## 기술 스택 (필수)
- **`react-hook-form`** — form state
- **`zod`** + **`@hookform/resolvers/zod`** — schema 정의 & validation
- form 타입은 zod 스키마로부터 `z.infer<typeof schema>` 로 도출

## 디렉토리 권장 구조
```
src/presentation/features/<domain>/forms/<formName>/
├── schema.ts        # zod 스키마, FormValues = z.infer<...>
├── mappers.ts       # apiToForm, formToApi (도메인 모델 ↔ FormValues)
├── <FormName>.tsx   # 컴포넌트 — useForm + 필드 렌더링
└── index.ts
```

> 매퍼 위치 가이드: API DTO 와 직접 매핑한다면 `src/business/<domain>/form-mappers.ts` 에 두는 것이 더 적절하다. **DTO ↔ Domain ↔ FormValues** 의 변환 책임을 business 에 몰아두면 presentation 은 도메인 모델만 알면 된다.

## 개발 패턴

### 1. 스키마 & 타입
```ts
// schema.ts
import { z } from 'zod';

export const userFormSchema = z.object({
  displayName: z.string().min(1, '이름을 입력해주세요'),
  email: z.string().email(),
  ageInput: z.string().regex(/^\d+$/, '숫자만'),  // ← 입력 편의를 위한 string
  receiveMarketing: z.boolean(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
```

### 2. 매퍼
```ts
// mappers.ts
import type { User } from '@/business/user/model';
import type { UpdateUserPayload } from '@/business/user/payload';
import type { UserFormValues } from './schema';

export function userToForm(user: User): UserFormValues {
  return {
    displayName: user.name,
    email: user.email,
    ageInput: String(user.age),       // number → string
    receiveMarketing: user.flags.marketing,
  };
}

export function formToUpdatePayload(values: UserFormValues): UpdateUserPayload {
  return {
    name: values.displayName.trim(),
    email: values.email,
    age: Number(values.ageInput),
    flags: { marketing: values.receiveMarketing },
  };
}
```

### 3. 컴포넌트
```tsx
// UserForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userFormSchema, type UserFormValues } from './schema';

type Props = {
  defaultValues: UserFormValues;
  onSubmit: (values: UserFormValues) => void;
};

export function UserForm({ defaultValues, onSubmit }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* fields ... */}
    </form>
  );
}
```

### 4. 호출 측 (page/feature 컨테이너)
```tsx
const { data: user } = useSuspenseQuery(userQueries.detail(id));
const { mutate } = useMutation(userMutations.update(queryClient));

<UserForm
  defaultValues={userToForm(user)}
  onSubmit={(values) => mutate(formToUpdatePayload(values))}
/>
```

## 금지 사항
- ❌ **`FormValues = ApiDto` / `FormValues extends ApiDto`** — 폼 타입을 API DTO 로부터 직접 파생
- ❌ 폼 컴포넌트가 API DTO 타입을 import / props 로 받음
- ❌ 폼 컴포넌트 내부에서 API/IPC 직접 호출 (`window.electronAPI`, api 레이어 import)
- ❌ 폼 컴포넌트가 `useMutation` 을 직접 호출하여 서버 호출까지 책임짐 — 제출은 `onSubmit` prop 으로 위임
- ❌ `react-hook-form` 외 다른 form 라이브러리, `zod` 외 다른 validation 라이브러리 혼용
- ❌ `defaultValues` 없이 controlled 상태로 양방향 바인딩
- ❌ form 안에서 비즈니스 규칙(도메인 검증) 수행 — zod 스키마는 **입력값 형식 검증**까지. 도메인 규칙은 business 의 검증 함수로.

## 검수 체크리스트
- [ ] `FormValues` 가 zod 스키마의 `z.infer` 로 도출되었는가
- [ ] API DTO 타입이 form 파일 어디에도 import 되지 않는가
- [ ] `apiToForm` / `formToApi` (또는 이름이 명확한) 매퍼가 존재하는가
- [ ] 폼 컴포넌트가 `defaultValues` 를 받고 `onSubmit(values)` 를 호출만 하는가 (서버 호출 미포함)
- [ ] `resolver: zodResolver(...)` 사용했는가
- [ ] 도메인 규칙이 form schema 가 아닌 business 에 있는가
- [ ] 입력 편의 타입(예: 숫자를 string 으로 받기)이 매퍼에서 정상 변환되는가
- [ ] 에러 메시지가 zod 스키마에 한국어로 명시되어 있는가 (또는 메시지 맵)

## 검수 명령
```bash
# 폼 파일 위치 (예시 경로)
SCOPE='src/presentation/**/forms/'

# react-hook-form / zod / zodResolver 사용 확인
grep -rE "from 'react-hook-form'" $SCOPE >/dev/null || echo "WARN: react-hook-form 미사용"
grep -rE "from 'zod'" $SCOPE >/dev/null || echo "WARN: zod 미사용"
grep -rE "zodResolver\(" $SCOPE >/dev/null || echo "WARN: zodResolver 미사용"

# API DTO import 금지
grep -rE "from '(\.\./)*api(/|')" $SCOPE && echo "VIOLATION: form imports api dto" || echo "OK"

# 폼 컴포넌트가 IPC 직접 호출 금지
grep -rE "window\.electronAPI" $SCOPE && echo "VIOLATION" || echo "OK"

# 폼 컴포넌트 내부에서 useMutation 직접 호출 금지 (제출은 onSubmit prop 으로)
grep -rE "useMutation\(" $SCOPE && echo "WARN: useMutation in form component — lift to container" || echo "OK"
```
