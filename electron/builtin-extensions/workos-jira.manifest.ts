// Jira integration extension. Disabled by default; users opt in and provide
// their Atlassian credentials in the inline settings form. The Atlassian REST
// API is called from the main process (electron/services/jira.service.ts) so
// the token never reaches the renderer over the network.

export const workosJiraManifest = {
  manifestVersion: 1,
  id: 'workos.jira',
  name: 'Jira',
  version: '0.1.0',
  description:
    'Atlassian Jira 와 연동해 내 담당 이슈 리스트와 간단한 지표를 사이드 패널에서 확인합니다.',
  author: 'workOS-Agent',
  contributes: {
    views: [
      {
        id: 'tasks',
        title: 'Jira Tasks',
        icon: 'J',
        body: [
          { type: 'custom', component: 'jira-task-list' },
        ],
      },
      {
        id: 'settings',
        title: 'Jira 설정',
        icon: '⚙',
        body: [
          {
            type: 'markdown',
            value:
              'Atlassian 에서 발급한 API 토큰과 도메인, 프로젝트 키를 입력하세요. 토큰은 OS 보안 저장소(safeStorage)로 암호화돼 디스크에 저장됩니다.',
          },
          { type: 'settings' },
          { type: 'custom', component: 'jira-test-connection' },
        ],
      },
    ],
    settings: {
      schema: {
        baseUrl: {
          type: 'string',
          title: 'Base URL',
          description: '예: https://your-domain.atlassian.net',
          default: 'https://your-domain.atlassian.net',
        },
        email: {
          type: 'string',
          title: 'Atlassian 계정 이메일',
          description: 'API 토큰과 함께 Basic 인증에 사용됩니다.',
          default: '',
        },
        token: {
          type: 'secret',
          title: 'API 토큰',
          description:
            'https://id.atlassian.com/manage-profile/security/api-tokens 에서 발급.',
          default: '',
        },
        projectKey: {
          type: 'string',
          title: '프로젝트 키',
          description:
            '여러 개를 콤마(,) 또는 공백으로 구분해 입력 가능. 예: PROJ, OPS, PLAT',
          default: '',
        },
      },
    },
    eventHooks: [],
  },
};
