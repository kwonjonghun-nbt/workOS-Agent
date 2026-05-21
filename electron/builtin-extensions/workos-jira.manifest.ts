// Jira integration extension. Disabled by default; users opt in and provide
// their Atlassian credentials in the inline settings form. The Atlassian REST
// API is called from the main process (electron/services/jira.service.ts) so
// the token never reaches the renderer over the network.

export const workosJiraManifest = {
  manifestVersion: 1,
  id: 'workos.jira',
  name: 'Jira',
  version: '0.2.0',
  description:
    'Atlassian Jira 와 연동해 내 담당 이슈 리스트·대시보드·라벨·리포트를 한 화면에서 관리합니다.',
  author: 'workOS-Agent',
  contributes: {
    // 단일 진입점만 액티비티 바에 노출하고, 내부 좌측 네비로 섹션을 전환한다.
    views: [
      {
        id: 'workspace',
        title: 'Jira',
        icon: 'J',
        body: [{ type: 'custom', component: 'jira-workspace' }],
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
