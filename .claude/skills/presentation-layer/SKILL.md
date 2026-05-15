---
name: presentation-layer
description: workOS-Agent의 Presentation 레이어(src/presentation/) 개발 및 검수. React 컴포넌트, 페이지, UI 훅, 폼·모달·라우팅 등 UI 관련 코드를 만들거나 리뷰할 때, "컴포넌트", "UI", "페이지", "프레젠테이션", "JSX" 키워드가 나오거나 src/presentation/** 파일을 다룰 때 사용한다.
---

# Presentation Layer Skill — src/presentation/

## 역할
JSX, 스타일, UI 상태(useState/useReducer), 폼, 라우팅, 토스트 등 **사용자 인터페이스**의 모든 것. 비즈니스 데이터는 business 또는 server-state 훅으로부터 받아 표시·전달한다.

## 개발 원칙

1. **호출 경로**: `src/business/**` 의 use-case 훅, 또는 `src/server-state/**` 의 query/mutation 훅만 호출. **API 레이어 직접 호출 절대 금지**.
2. **로컬 UI 상태**는 useState/useReducer 로 컴포넌트 내부에 둔다. 서버 데이터는 server-state 캐시에 둔다.
3. **컴포넌트 분리**: page (라우트 진입점) / feature 컴포넌트 / 공용 UI 컴포넌트 단위로 디렉토리 구성.
   ```
   src/presentation/
   ├── pages/
   ├── features/<domain>/
   └── ui/         # 디자인 시스템 수준 컴포넌트
   ```
4. **Tailwind 클래스**로 스타일링. 인라인 style 은 동적 값에만 한정.
5. **부수효과 일관성**: 토스트, 라우팅 같은 UI 부수효과는 이 레이어에서 처리. business/server-state 가 직접 호출하지 않음.

## 금지 사항
- ❌ `src/api/**` import
- ❌ `window.electronAPI` 직접 호출
- ❌ 비즈니스 규칙/검증 로직을 컴포넌트 내부에 작성 (business 로 추출)
- ❌ DTO 를 컴포넌트에서 직접 다루기 (business 의 도메인 모델 사용)
- ❌ queryKey 인라인 작성, 직접 queryClient 조작 (server-state 의 훅 사용)

## 검수 체크리스트
- [ ] api 레이어 import 가 전혀 없는가
- [ ] `window.electronAPI` 직접 호출이 없는가
- [ ] 컴포넌트 내부에 비즈니스 규칙(if-else 분기로 도메인 결정)이 박혀있지 않은가
- [ ] 폼 검증이 단순 UI 검증(필수값 등) 외에 도메인 규칙을 포함하지 않는가 (포함 시 business 로 이동)
- [ ] DTO 타입이 직접 노출되지 않고 Domain 모델을 쓰는가
- [ ] 토스트/네비게이션 등 UI 부수효과를 이 레이어가 책임지는가

## 검수 명령
```bash
grep -rE "from '(\.\./)*api(/|')" src/presentation/ && echo "VIOLATION" || echo "OK"
grep -rE "window\.electronAPI" src/presentation/ && echo "VIOLATION" || echo "OK"
grep -rE "useQueryClient\(\)\.(invalidate|setQueryData)" src/presentation/ && echo "WARN: direct cache mutation" || echo "OK"
```
