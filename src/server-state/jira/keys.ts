export const jiraKeys = {
  all: ['jira'] as const,
  myIssues: (maxResults: number) => [...jiraKeys.all, 'myIssues', { maxResults }] as const,
  issueDetail: (issueKey: string) => [...jiraKeys.all, 'issueDetail', issueKey] as const,
};
