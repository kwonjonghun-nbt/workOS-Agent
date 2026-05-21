# 확장 프로그램 (Extensions)

workOS-Agent 의 확장은 **앱과 함께 출고되는 1st-party 기능 모듈**입니다. 사용자는 GitHub 같은 외부 소스에서 임의 확장을 설치하지 않고, 카탈로그에 정의된 공식 확장 중 필요한 것만 **켜고 끄는** 식으로 사용합니다.

기술적으로는 **선언형 manifest** 로 정의됩니다. 확장은 JavaScript 를 실행하지 않고, 어떤 UI 를 기여하고 어떤 이벤트에 어떻게 반응할지를 데이터로 선언합니다. 앱 본체가 이를 해석해 동작을 수행합니다.

---

## 사용자 경험

좌측 액티비티 바의 **⌬ Extensions** 아이콘 → 사이드 패널에 모든 공식 확장의 목록이 노출됩니다.

- 각 항목에 **활성화 토글**.
- 설정을 제공하는 확장은 행 아래의 **▸ 설정** 을 펼쳐 폼으로 조정.
- 확장이 사이드바 뷰를 contribute 하면, 활성화 즉시 액티비티 바에 해당 뷰 아이콘이 추가됨.

사용자 상태(켜짐/꺼짐, 설정값)는 `<userData>/extensions-state.json` 에 저장됩니다. 모든 확장은 **기본값이 꺼짐** 입니다.

---

## 새로운 확장을 추가하려면 (개발자)

1. `electron/builtin-extensions/<id>.manifest.ts` 파일을 만들어 manifest 객체를 export.
2. `electron/builtin-extensions/index.ts` 에 import 추가 후 `RAW_MANIFESTS` 배열에 push.
3. 앱 재시작. manifest 는 부팅 시 zod 로 검증되며 유효하지 않으면 즉시 throw.

런타임 파일 스캔 없이 컴파일 타임에 카탈로그가 고정되므로, 잘못된 확장이 production 에 섞일 수 없습니다.

---

## Manifest v1 스펙

```ts
{
  manifestVersion: 1,                  // 항상 1
  id: 'workos.your-extension',         // 영문 소문자/숫자/. _ -. 카탈로그 내 고유
  name: 'Your Extension',
  version: '0.1.0',                    // semver-like X.Y.Z[-pre]
  description: '한 줄 설명',
  author: 'Your Name',                 // 선택
  homepage: 'https://...',             // 선택
  contributes: {
    views: [ /* 사이드바 패널들 */ ],
    settings: { schema: { /* ... */ } },
    eventHooks: [ /* 이벤트 반응 */ ],
  },
}
```

### `contributes.views`

각 view 는 활동 바에 아이콘 버튼으로 노출되고, 클릭 시 사이드 패널이 열립니다.

```ts
{
  id: 'main',          // 확장 내에서 고유
  title: 'Hello',      // 패널 헤더
  icon: '♥',           // 한 글자/이모지
  body: [
    { type: 'markdown', value: '여기에 본문' },
    { type: 'settings' },             // 이 확장의 설정 폼을 인라인 렌더
  ],
}
```

지원 body 블록:
- `markdown` — `value` 를 그대로 표시 (현재 plain text)
- `settings` — 이 확장의 설정 폼을 인라인 렌더

### `contributes.settings.schema`

키 → 필드 디스크립터 맵. JSON Schema 의 경량 부분집합.

```ts
{
  schema: {
    greeting: {
      type: 'string',
      title: '인사말',
      description: '토스트 머리에 들어갈 문구',
      default: '안녕',
      enum: ['안녕', 'Hello', 'Hola'],   // 선택. 있으면 select 박스로 렌더.
    },
    threshold: { type: 'number', title: '임계값', default: 5, min: 0, max: 100 },
    enabled: { type: 'boolean', title: '활성화', default: true },
  },
}
```

저장된 값은 eventHook 액션의 `${settings.<key>}` 템플릿으로 참조 가능합니다.

### `contributes.eventHooks`

호스트가 발생시키는 이벤트에 반응합니다. v1 지원 이벤트:

| event | payload 필드 |
|---|---|
| `terminal:exit` | `sessionId`, `workspaceId`, `exitCode`, `signal` |

```ts
[
  {
    on: 'terminal:exit',
    when: { exitCode: 0 },   // 선택. 모든 키가 == 매치되어야 발화.
    do: {
      type: 'notify',
      level: 'info',
      message: '${settings.greeting}, 종료됨 exit=${exitCode}',
    },
  },
]
```

- `when` 미지정 시 항상 발화.
- 값 비교는 `String()` 정규화 — `{ exitCode: 0 }` 과 `{ exitCode: "0" }` 동일.
- 메시지 템플릿 `${name}` 은 payload 필드 또는 `settings.<key>` 치환.

지원 액션 (`do.type`):
- `notify` — 토스트 알림. 확장 이름이 자동 prefix 됨.

---

## 라이프사이클

확장은 카탈로그 안에 항상 존재하지만, 다음 조건에서만 동작합니다:

- 활동 바 아이콘은 `enabled === true` 일 때만 표시
- eventHook 은 `enabled === true` 일 때만 발화

활성화/비활성화 및 설정 변경은 즉시 반영됩니다. 재시작 불필요.

---

## IPC 채널

확장 관리는 다음 채널을 사용합니다:

- `extension:list` — 카탈로그 + 사용자 상태 머지된 목록 반환
- `extension:setEnabled` — `{ id, enabled }`
- `extension:updateSettings` — `{ id, settings }`
- Push: `extension:changed` — 변경 후 전체 목록 broadcast

자세한 시그니처는 `electron/contracts/extension.ts` 와 `electron/contracts/channels.ts` 참고.

---

## 파일 시스템 레이아웃

```
<repo>/electron/builtin-extensions/
  index.ts                          ← 카탈로그 entry point (정적 import)
  <id>.manifest.ts                  ← 확장별 manifest 정의 (TS 객체)

<userData>/extensions-state.json    ← 사용자별 enabled/settings 상태 (atomic write)
```
