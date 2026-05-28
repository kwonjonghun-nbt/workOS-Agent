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
        icon: 'mark:jira',
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
        slackEnabled: {
          type: 'boolean',
          title: 'Slack 데일리 공유 활성화',
          description: '진행중 작업을 담당자별로 슬랙 스레드에 자동 댓글로 공유합니다.',
          default: false,
        },
        slackBotToken: {
          type: 'secret',
          title: 'Slack Bot Token',
          description:
            'xoxb-... 형식. 권한: channels:history, groups:history, chat:write',
          default: '',
        },
        slackChannelId: {
          type: 'string',
          title: 'Slack Channel ID',
          description: '채널 우클릭 → 채널 세부정보 → 하단의 Channel ID',
          default: '',
        },
        slackThreadSearchText: {
          type: 'string',
          title: '스레드 검색 텍스트',
          description:
            '오늘 날짜의 채널 메시지 중 이 텍스트를 포함한 메시지를 찾아 스레드 댓글로 답니다. 예: "데일리 스탠드업"',
          default: '',
        },
        slackDailyReportTime: {
          type: 'string',
          title: '자동 전송 시각 (HH:MM)',
          description: '매일 이 시각에 데일리 리포트를 자동 전송합니다. 비워두면 자동 전송을 끕니다.',
          default: '10:00',
        },
        statusTransitions: {
          type: 'string',
          title: '상태 전환 매핑 (JSON)',
          description:
            'TaskItem status → Jira transition. JSON 으로 직접 편집하거나, 워크OS Jira 설정의 "상태 전환 매핑 편집기" UI에서 키-값으로 편집하세요. 값은 transition 이름 문자열 또는 {id,name,toStatus} 객체.',
          default: '{"in_progress":"In Progress","completed":"Done"}',
        },
        statusTransitionsByProject: {
          type: 'string',
          title: '프로젝트별 상태 전환 매핑 (JSON, 선택)',
          description:
            '특정 프로젝트 키별로 statusTransitions 를 override 합니다. 예: {"PROJ":{"in_progress":{"id":"21","name":"In Progress"}}}. 비워두면 statusTransitions 가 모든 프로젝트에 적용됩니다.',
          default: '',
        },
      },
    },
    eventHooks: [],
  },
};
