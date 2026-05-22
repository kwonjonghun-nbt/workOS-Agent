// Macro Buttons extension. Stream Deck-style grid of buttons. Each button
// runs a sequence of actions (shell command / HTTP request / delay /
// os.open / clipboard). Boards & buttons are persisted in a dedicated repo
// (electron/repositories/macro.repo.ts); execution output streams to the
// extension's dedicated terminal panel.

export const workosMacroButtonsManifest = {
  manifestVersion: 1,
  id: 'workos.macro-buttons',
  name: 'Macro Buttons',
  version: '0.1.0',
  description:
    '스트림덱처럼 그리드 버튼에 터미널 명령·HTTP 호출·OS 동작을 등록해 한 번에 실행합니다.',
  author: 'workOS-Agent',
  contributes: {
    views: [
      {
        id: 'workspace',
        title: 'Macro Buttons',
        icon: '⊞',
        body: [{ type: 'custom', component: 'macro-buttons-workspace' }],
      },
    ],
    settings: {
      schema: {},
    },
    eventHooks: [],
  },
};
