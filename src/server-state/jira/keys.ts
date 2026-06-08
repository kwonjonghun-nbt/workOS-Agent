export const jiraKeys = {
  all: ['jira'] as const,
  myIssues: (maxResults: number) => [...jiraKeys.all, 'myIssues', { maxResults }] as const,
  issueDetail: (issueKey: string) => [...jiraKeys.all, 'issueDetail', issueKey] as const,
  issueTypes: (projectKey: string) => [...jiraKeys.all, 'issueTypes', projectKey] as const,
  epics: (projectKey: string) => [...jiraKeys.all, 'epics', projectKey] as const,
  search: (text: string) => [...jiraKeys.all, 'search', text] as const,
  projects: () => [...jiraKeys.all, 'projects'] as const,
};
