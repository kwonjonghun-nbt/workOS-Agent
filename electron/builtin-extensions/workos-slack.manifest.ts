// Slack Digest extension. Reads a user's Slack workspace via the Web API and
// runs the host's claude CLI to produce period summaries of a channel or a
// thread. Also surfaces messages the user has reacted to with configured
// emojis (a personal bookmark stream).
//
// All API calls run from the main process (electron/services/slack.service.ts)
// so the User/Bot token never reaches the renderer over the network.

export const workosSlackManifest = {
  manifestVersion: 1,
  id: 'workos.slack',
  name: 'Slack Digest',
  version: '0.1.0',
  description:
    'Slack 채널/스레드의 선택한 기간 대화를 claude 로 요약하고, 내가 단 이모지가 붙은 메시지를 모아 보여줍니다.',
  author: 'workOS-Agent',
  contributes: {
    views: [
      {
        id: 'workspace',
        title: 'Slack',
        icon: 'mark:slack',
        body: [{ type: 'custom', component: 'slack-workspace' }],
      },
    ],
    settings: {
      schema: {
        tokenMode: {
          type: 'string',
          title: '사용할 토큰',
          description:
            'User Token(xoxp): 본인이 보는 모든 채널/DM 접근 + 내 reaction 조회 가능. Bot Token(xoxb): bot 이 초대된 채널만 + reaction 기능 불가.',
          default: 'user',
          enum: ['user', 'bot'],
        },
        userToken: {
          type: 'secret',
          title: 'User OAuth Token (xoxp-...)',
          description:
            '권한: channels:history, groups:history, im:history, mpim:history, channels:read, groups:read, im:read, mpim:read, users:read, reactions:read',
          default: '',
        },
        botToken: {
          type: 'secret',
          title: 'Bot Token (xoxb-...)',
          description:
            'bot 이 초대된 채널만 읽을 수 있습니다. reaction 수집 기능은 동작하지 않습니다.',
          default: '',
        },
        defaultEmojis: {
          type: 'string',
          title: '북마크 이모지',
          description:
            '"내 reaction 수집"이 모아줄 이모지 이름. 콤마 또는 공백으로 구분. 예: bookmark, star, memo',
          default: 'bookmark',
        },
      },
    },
    eventHooks: [],
  },
};
