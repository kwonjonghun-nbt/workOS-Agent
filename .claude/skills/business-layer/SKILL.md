---
name: business-layer
description: workOS-Agent의 Business 레이어(src/business/) 개발 및 검수. 도메인 모델, use-case, 비즈니스 규칙/검증/계산 로직을 만들거나 리뷰할 때, "비즈니스 로직", "도메인", "use-case", "유스케이스" 키워드가 나오거나 src/business/** 파일을 다룰 때 사용한다.
---

# Business Layer Skill — src/business/

## 역할
도메인 모델 정의, use-case(여러 쿼리/뮤테이션 조합), 비즈니스 규칙·검증·계산을 담당. React 와 무관한 **순수 TypeScript 로직 + react 훅 형태의 use-case** 가 공존할 수 있다.

## 개발 원칙

1. **호출 경로**: server-state 레이어의 훅을 호출하거나, 순수 함수 단위로 데이터를 가공한다. **API 레이어 직접 호출 금지** (반드시 server-state 경유).
2. **도메인 모델은 이곳이 소유**: DTO → Domain 변환은 여기서. `toUser(dto)` 같은 매퍼.
3. **검증/계산은 순수 함수**로 작성하여 단위 테스트 가능하도록 한다.
4. **use-case 훅** (`useCreateUserUseCase` 등) 은 react 훅이지만 JSX 반환 금지. 여러 server-state 훅을 조합하고 도메인 규칙을 적용하여 Presentation 이 쉽게 쓸 수 있는 형태로 제공.
5. **UI 상태 금지**: form 상태, 모달 열림 여부 같은 것은 presentation 의 책임.

## 금지 사항
- ❌ `src/api/**` 직접 import
- ❌ `src/presentation/**` import
- ❌ JSX 반환 / 컴포넌트 정의
- ❌ DOM API, 라우터 직접 사용
- ❌ `window.electronAPI` 직접 호출

## 검수 체크리스트
- [ ] api 레이어 직접 import 가 없는가
- [ ] presentation 레이어 import 가 없는가
- [ ] DTO → Domain 매퍼가 명확히 분리되어 있는가
- [ ] 비즈니스 규칙이 순수 함수로 추출되어 테스트 가능한가
- [ ] use-case 훅이 JSX 를 반환하지 않는가
- [ ] form/UI 상태가 섞이지 않았는가

## 검수 명령
```bash
grep -rE "from '(\.\./)*api(/|')" src/business/ && echo "VIOLATION: direct api import" || echo "OK"
grep -rE "from '(\.\./)*presentation" src/business/ && echo "VIOLATION" || echo "OK"
grep -rE "window\.electronAPI" src/business/ && echo "VIOLATION" || echo "OK"
grep -rE "return\s+<|=>\s*<" src/business/ && echo "VIOLATION: JSX in business" || echo "OK"
```
