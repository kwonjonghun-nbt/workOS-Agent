import type { AtlassianIssue, JiraConfig } from '../domain/jira';
import { buildSearchJql } from '../domain/jira';
import type { AtlassianIssueRaw } from '../domain/jira-issue';
import { SNAPSHOT_FIELDS } from '../domain/jira-issue';
import { ApiError } from '../infra/error';

/**
 * Repository for the Atlassian REST API. Owns the network adapter; surfaces
 * domain errors to callers and never lets transport details leak upward.
 *
 * Diagnostics: every request logs URL + status + a short response preview to
 * the main-process console so we can see what Jira returned without dumping
 * tokens.
 */
export type JiraMyself = {
  accountId: string;
  displayName: string;
  emailAddress: string | null;
};

export interface JiraRepository {
  searchAssignedIssues(
    config: JiraConfig,
    maxResults: number,
  ): Promise<{ raw: AtlassianIssue[]; total: number }>;
  /**
   * Paginated full-snapshot search. Returns the union of all issues matching
   * the snapshot JQL with the rich field set (labels, due date, story points,
   * etc). Used by the snapshot pipeline only — the lightweight list view
   * keeps using {@link searchAssignedIssues}.
   */
  searchAssignedIssuesFull(
    config: JiraConfig,
    maxPages?: number,
  ): Promise<{ raw: AtlassianIssueRaw[] }>;
  searchByLabel(
    config: JiraConfig,
    projectKey: string,
    label: string,
  ): Promise<{ issues: Array<{ key: string; summary: string; labels: string[]; status: string }> }>;
  replaceLabelOnIssue(
    config: JiraConfig,
    issueKey: string,
    oldLabel: string,
    newLabel: string,
  ): Promise<void>;
  setIssueLabels(
    config: JiraConfig,
    issueKey: string,
    labels: string[],
  ): Promise<void>;
  getMyself(config: JiraConfig): Promise<JiraMyself>;
  /**
   * 단일 이슈 조회 — description(ADF) 포함. 검토/제안 흐름 전용.
   */
  getIssueDetail(
    config: JiraConfig,
    issueKey: string,
  ): Promise<{
    key: string;
    summary: string;
    issueType: string;
    parentKey: string | null;
    description: unknown;
  }>;
  /** 부모 이슈(에픽 포함) 의 자식 티켓들을 description 포함해 조회. */
  searchChildrenOfParent(
    config: JiraConfig,
    parentKey: string,
    maxResults?: number,
  ): Promise<
    Array<{ key: string; summary: string; status: string; description: unknown }>
  >;
  /** description(ADF) 만 업데이트. */
  updateIssueDescription(
    config: JiraConfig,
    issueKey: string,
    descriptionAdf: unknown,
  ): Promise<void>;
}

const LOG = (...args: unknown[]) => console.log('[jira.repo]', ...args);

export class HttpJiraRepository implements JiraRepository {
  async searchAssignedIssues(
    config: JiraConfig,
    maxResults: number,
  ): Promise<{ raw: AtlassianIssue[]; total: number }> {
    // Use the modern /search/jql endpoint (the legacy /search is being retired).
    // Response shape: { issues, nextPageToken, isLast } — no `total`.
    const url = `${config.baseUrl}/rest/api/3/search/jql`;
    const jql = buildSearchJql(config.projectKeys);
    const body = {
      jql,
      maxResults,
      fields: [
        'summary',
        'status',
        'priority',
        'issuetype',
        'assignee',
        'reporter',
        'created',
        'updated',
      ],
    };
    LOG('POST', url, 'jql=', jql, 'projectKeys=', config.projectKeys);
    const res = await this.request(config, url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      issues?: AtlassianIssue[];
      total?: number;
      nextPageToken?: string;
    };
    const issues = Array.isArray(json.issues) ? json.issues : [];
    LOG('search ok:', issues.length, 'issues; total=', json.total ?? '(none)');
    return {
      raw: issues,
      total: typeof json.total === 'number' ? json.total : issues.length,
    };
  }

  async searchAssignedIssuesFull(
    config: JiraConfig,
    maxPages = 20,
  ): Promise<{ raw: AtlassianIssueRaw[] }> {
    const url = `${config.baseUrl}/rest/api/3/search/jql`;
    const jql = buildSearchJql(config.projectKeys);
    const all: AtlassianIssueRaw[] = [];
    let nextPageToken: string | undefined;
    for (let page = 0; page < maxPages; page += 1) {
      const body: Record<string, unknown> = {
        jql,
        maxResults: 100,
        fields: SNAPSHOT_FIELDS,
      };
      if (nextPageToken) body.nextPageToken = nextPageToken;
      LOG('POST', url, 'snapshot page=', page, 'token=', nextPageToken ?? '(initial)');
      const res = await this.request(config, url, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        issues?: AtlassianIssueRaw[];
        nextPageToken?: string;
        isLast?: boolean;
      };
      const issues = Array.isArray(json.issues) ? json.issues : [];
      all.push(...issues);
      LOG('snapshot page ok:', issues.length, 'total so far=', all.length);
      if (json.isLast || !json.nextPageToken) break;
      nextPageToken = json.nextPageToken;
    }
    return { raw: all };
  }

  async searchByLabel(
    config: JiraConfig,
    projectKey: string,
    label: string,
  ): Promise<{ issues: Array<{ key: string; summary: string; labels: string[]; status: string }> }> {
    const url = `${config.baseUrl}/rest/api/3/search/jql`;
    const escapedLabel = label.replace(/"/g, '');
    const jql = `project = "${projectKey.replace(/"/g, '')}" AND labels = "${escapedLabel}"`;
    const body = {
      jql,
      maxResults: 100,
      fields: ['summary', 'labels', 'status'],
    };
    LOG('searchByLabel jql=', jql);
    const res = await this.request(config, url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      issues?: Array<{
        key?: string;
        fields?: {
          summary?: string;
          labels?: string[];
          status?: { name?: string };
        };
      }>;
    };
    const issues = (json.issues ?? []).map((i) => ({
      key: String(i.key ?? ''),
      summary: String(i.fields?.summary ?? ''),
      labels: Array.isArray(i.fields?.labels) ? i.fields!.labels!.map(String) : [],
      status: String(i.fields?.status?.name ?? ''),
    }));
    return { issues };
  }

  async replaceLabelOnIssue(
    config: JiraConfig,
    issueKey: string,
    oldLabel: string,
    newLabel: string,
  ): Promise<void> {
    const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`;
    const body = {
      update: {
        labels: [{ remove: oldLabel }, { add: newLabel }],
      },
    };
    LOG('PUT (replace label)', issueKey, oldLabel, '→', newLabel);
    await this.request(config, url, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async setIssueLabels(
    config: JiraConfig,
    issueKey: string,
    labels: string[],
  ): Promise<void> {
    const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`;
    const body = { fields: { labels } };
    LOG('PUT (set labels)', issueKey, labels);
    await this.request(config, url, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async getIssueDetail(
    config: JiraConfig,
    issueKey: string,
  ): Promise<{
    key: string;
    summary: string;
    issueType: string;
    parentKey: string | null;
    description: unknown;
  }> {
    const fields = ['summary', 'issuetype', 'parent', 'description'].join(',');
    const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=${fields}`;
    LOG('GET', url);
    const res = await this.request(config, url, { method: 'GET' });
    const json = (await res.json()) as {
      key?: string;
      fields?: {
        summary?: string;
        issuetype?: { name?: string };
        parent?: { key?: string } | null;
        description?: unknown;
      };
    };
    const f = json.fields ?? {};
    return {
      key: String(json.key ?? issueKey),
      summary: String(f.summary ?? ''),
      issueType: String(f.issuetype?.name ?? ''),
      parentKey: f.parent?.key ?? null,
      description: f.description ?? null,
    };
  }

  async searchChildrenOfParent(
    config: JiraConfig,
    parentKey: string,
    maxResults = 50,
  ): Promise<
    Array<{ key: string; summary: string; status: string; description: unknown }>
  > {
    const url = `${config.baseUrl}/rest/api/3/search/jql`;
    const escapedKey = parentKey.replace(/"/g, '');
    const jql = `parent = "${escapedKey}"`;
    const body = {
      jql,
      maxResults,
      fields: ['summary', 'status', 'description'],
    };
    LOG('searchChildrenOfParent jql=', jql);
    const res = await this.request(config, url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      issues?: Array<{
        key?: string;
        fields?: {
          summary?: string;
          status?: { name?: string };
          description?: unknown;
        };
      }>;
    };
    return (json.issues ?? []).map((i) => ({
      key: String(i.key ?? ''),
      summary: String(i.fields?.summary ?? ''),
      status: String(i.fields?.status?.name ?? ''),
      description: i.fields?.description ?? null,
    }));
  }

  async updateIssueDescription(
    config: JiraConfig,
    issueKey: string,
    descriptionAdf: unknown,
  ): Promise<void> {
    const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`;
    const body = { fields: { description: descriptionAdf } };
    LOG('PUT (description)', issueKey);
    await this.request(config, url, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async getMyself(config: JiraConfig): Promise<JiraMyself> {
    const url = `${config.baseUrl}/rest/api/3/myself`;
    LOG('GET', url);
    const res = await this.request(config, url, { method: 'GET' });
    const json = (await res.json()) as {
      accountId?: string;
      displayName?: string;
      emailAddress?: string;
    };
    LOG('myself ok:', json.displayName, '(', json.accountId, ')');
    return {
      accountId: String(json.accountId ?? ''),
      displayName: String(json.displayName ?? ''),
      emailAddress: json.emailAddress ?? null,
    };
  }

  private async request(
    config: JiraConfig,
    url: string,
    init: { method: string; body?: string },
  ): Promise<Response> {
    const auth = Buffer.from(`${config.email}:${config.token}`).toString('base64');
    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method,
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: init.body,
      });
    } catch (err) {
      LOG('network error:', err instanceof Error ? err.message : err);
      throw new ApiError(
        'INTERNAL',
        `Jira API 호출 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    LOG('←', res.status, res.statusText, url);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      LOG('error body:', text.slice(0, 300));
      if (res.status === 401 || res.status === 403) {
        throw new ApiError(
          'VALIDATION',
          `Jira 인증 실패 (${res.status}). 이메일/API 토큰을 확인하세요.`,
        );
      }
      if (res.status === 404) {
        throw new ApiError(
          'VALIDATION',
          `Jira 엔드포인트를 찾을 수 없음 (404). Base URL 을 확인하세요.`,
        );
      }
      throw new ApiError(
        'INTERNAL',
        `Jira API 오류 ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    return res;
  }
}
