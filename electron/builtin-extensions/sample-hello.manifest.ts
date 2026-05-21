// First-party demo extension. Disabled by default — users opt in from the
// catalog UI. Demonstrates all three v1 capabilities (view, settings, eventHook).

export const sampleHelloManifest = {
  manifestVersion: 1,
  id: 'workos.sample-hello',
  name: 'Sample Hello',
  version: '0.1.0',
  description:
    '확장 시스템 데모. 사이드바 패널 · 설정 · 터미널 종료 알림 hook 을 모두 시연합니다.',
  author: 'workOS-Agent',
  contributes: {
    views: [
      {
        id: 'main',
        title: 'Hello',
        icon: '♥',
        body: [
          {
            type: 'markdown',
            value:
              '이건 선언형 확장이 contribute 한 사이드바 패널입니다.\n\n- 아래는 이 확장의 설정 폼이에요. 값을 바꿔 저장하면 다음 hook 발화에 반영됩니다.\n- 터미널을 띄우고 종료해보면 터미널 종료 hook 이 토스트를 띄웁니다.',
          },
          { type: 'settings' },
        ],
      },
    ],
    settings: {
      schema: {
        greeting: {
          type: 'string',
          title: '인사말',
          description: '터미널 종료 토스트의 앞부분에 들어갈 문구',
          default: '안녕',
        },
      },
    },
    eventHooks: [
      {
        on: 'terminal:exit',
        when: { exitCode: 0 },
        do: {
          type: 'notify',
          level: 'info',
          message: '${settings.greeting}, 터미널 정상 종료 (session: ${sessionId})',
        },
      },
      {
        on: 'terminal:exit',
        do: {
          type: 'notify',
          level: 'warn',
          message: '${settings.greeting}, 터미널 종료됨 (exitCode=${exitCode})',
        },
      },
    ],
  },
};
