import type { AtlassianIssue, JiraConfig } from '../domain/jira';
import { buildSearchJql } from '../domain/jira';
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
  getMyself(config: JiraConfig): Promise<JiraMyself>;
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
