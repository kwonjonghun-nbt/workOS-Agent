// GitHub PR integration extension. Disabled by default; users opt in and
// provide a personal access token + repo list in the inline settings form.
// The GitHub REST API is called from the main process so the token never
// leaves the host.

export const workosGithubPrManifest = {
  manifestVersion: 1,
  id: 'workos.github-pr',
  name: 'GitHub PRs',
  version: '0.1.0',
  description:
    '등록한 GitHub 레포의 Pull Request를 한 화면에서 모아보고 상태별·레포별로 필터합니다.',
  author: 'workOS-Agent',
  contributes: {
    views: [
      {
        id: 'workspace',
        title: 'GitHub PR',
        icon: 'G',
        body: [{ type: 'custom', component: 'github-pr-workspace' }],
      },
    ],
    settings: {
      schema: {
        token: {
          type: 'secret',
          title: 'GitHub Personal Access Token',
          description:
            'https://github.com/settings/tokens 에서 발급. 필요한 권한: repo (또는 public_repo).',
          default: '',
        },
        repos: {
          type: 'string',
          title: '레포 목록',
          description:
            'owner/repo 형식. 여러 개는 콤마(,) 또는 공백으로 구분. 예: vercel/next.js, facebook/react',
          default: '',
        },
        apiUrl: {
          type: 'string',
          title: 'GitHub API URL',
          description: 'GitHub Enterprise는 https://github.your-domain.com/api/v3 형태로 입력.',
          default: 'https://api.github.com',
        },
      },
    },
    eventHooks: [],
  },
};
