import { z } from 'zod';

/**
 * Jira issue (subset) returned to the renderer. We narrow Atlassian's REST
 * payload to a small projection — enough to render a list with basic metrics.
 */
export const jiraIssueSchema = z.object({
  id: z.string(),
  key: z.string(),
  summary: z.string(),
  status: z.string(),
  statusCategory: z.string(),
  priority: z.string().nullable(),
  issueType: z.string(),
  assignee: z.string().nullable(),
  reporter: z.string().nullable(),
  created: z.string(),
  updated: z.string(),
  url: z.string(),
});
export type JiraIssue = z.infer<typeof jiraIssueSchema>;

export const listMyIssuesRequestSchema = z.object({
  // Pagination — kept simple; UI fetches first page only for v1.
  maxResults: z.number().int().min(1).max(100).default(50),
});
export type ListMyIssuesRequest = z.infer<typeof listMyIssuesRequestSchema>;

export type ListMyIssuesResponse = {
  issues: JiraIssue[];
  total: number;
};

export type TestConnectionResponse = {
  ok: true;
  accountId: string;
  displayName: string;
  emailAddress: string | null;
  baseUrl: string;
  projectKeys: string[];
  matchedIssues: number;
};

export const getIssueDetailRequestSchema = z.object({
  issueKey: z.string().min(1),
});
export type GetIssueDetailRequest = z.infer<typeof getIssueDetailRequestSchema>;

export type GetIssueDetailResponse = {
  key: string;
  summary: string;
  issueType: string;
  parentKey: string | null;
  /** ADF → 마크다운으로 변환된 본문. */
  descriptionMarkdown: string;
};

/**
 * 세션 게이트의 "새 Jira 생성" 폼이 사용하는 이슈 타입 후보 조회.
 * projectKey 를 비우면 확장 설정의 첫 프로젝트 키를 사용한다.
 */
export const listIssueTypesRequestSchema = z.object({
  projectKey: z.string().optional(),
});
export type ListIssueTypesRequest = z.infer<typeof listIssueTypesRequestSchema>;

export type JiraIssueType = {
  id: string;
  name: string;
  subtask: boolean;
  /** Jira 계층 레벨: -1 subtask, 0 standard, 1 epic. 없으면 null. */
  hierarchyLevel: number | null;
};

export type ListIssueTypesResponse = {
  projectKey: string;
  issueTypes: JiraIssueType[];
};

export const createIssueRequestSchema = z.object({
  projectKey: z.string().min(1),
  issueTypeId: z.string().min(1),
  summary: z.string().min(1).max(255),
  /** 마크다운 본문 — main 에서 ADF 로 변환되어 전송된다. 비워도 됨. */
  descriptionMarkdown: z.string().optional(),
  /** 상위 에픽 키(있으면 fields.parent 로 연결). 에픽 자체를 만들 땐 비운다. */
  parentKey: z.string().optional(),
});
export type CreateIssueRequest = z.infer<typeof createIssueRequestSchema>;

export type CreateIssueResponse = {
  key: string;
  url: string;
};

/** 새 티켓 생성 시 선택할 상위 에픽 후보. */
export const listEpicsRequestSchema = z.object({
  projectKey: z.string().optional(),
});
export type ListEpicsRequest = z.infer<typeof listEpicsRequestSchema>;

export type JiraEpic = {
  key: string;
  summary: string;
};

export type ListEpicsResponse = {
  projectKey: string;
  epics: JiraEpic[];
};

/** 생성 폼에서 선택 가능한 프로젝트 목록(설정된 프로젝트 키 기준). */
export type JiraProject = {
  key: string;
  name: string;
};

export type ListProjectsResponse = {
  projects: JiraProject[];
};

/** 기존 티켓 선택용 자유 텍스트 검색. */
export const searchIssuesRequestSchema = z.object({
  text: z.string().default(''),
  maxResults: z.number().int().min(1).max(100).default(50),
});
export type SearchIssuesRequest = z.infer<typeof searchIssuesRequestSchema>;
