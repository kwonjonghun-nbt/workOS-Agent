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
  /** 신규 이슈 생성. parentKey 가 있으면 부모 링크. */
  createIssue(
    config: JiraConfig,
    args: {
      projectKey: string;
      summary: string;
      issueType: string;
      parentKey?: string;
      description?: string;
    },
  ): Promise<{ key: string; issueType: string }>;
  /** 부모 이슈 메타와 자식 티켓들을 함께 반환. */
  getIssueChildren(
    config: JiraConfig,
    parentKey: string,
  ): Promise<{
    parent: { key: string; summary: string; issueType: string; status: string };
    children: Array<{ key: string; summary: string; issueType: string; status: string }>;
  }>;
  /** 사용 가능한 transition 목록. */
  getTransitions(
    config: JiraConfig,
    issueKey: string,
  ): Promise<Array<{ id: string; name: string; to: string }>>;
  /** transition id 로 상태 전환. */
  transitionIssue(
    config: JiraConfig,
    issueKey: string,
    transitionId: string,
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

  async createIssue(
    config: JiraConfig,
    args: {
      projectKey: string;
      summary: string;
      issueType: string;
      parentKey?: string;
      description?: string;
    },
  ): Promise<{ key: string; issueType: string }> {
    const url = `${config.baseUrl}/rest/api/3/issue`;
    const fields: Record<string, unknown> = {
      project: { key: args.projectKey },
      summary: args.summary,
      issuetype: { name: args.issueType },
    };
    if (args.parentKey) {
      fields.parent = { key: args.parentKey };
    }
    if (args.description && args.description.trim() !== '') {
      fields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: args.description }],
          },
        ],
      };
    }
    LOG('POST createIssue', url, 'projectKey=', args.projectKey, 'issueType=', args.issueType);
    const res = await this.request(config, url, {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });
    const json = (await res.json()) as { key?: string };
    if (!json.key) {
      throw new ApiError('INTERNAL', 'Jira createIssue: 응답에 key 가 없습니다.');
    }
    return { key: json.key, issueType: args.issueType };
  }

  async getIssueChildren(
    config: JiraConfig,
    parentKey: string,
  ): Promise<{
    parent: { key: string; summary: string; issueType: string; status: string };
    children: Array<{ key: string; summary: string; issueType: string; status: string }>;
  }> {
    // 부모 이슈 조회
    const parentUrl = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(parentKey)}?fields=summary,issuetype,status`;
    LOG('GET parent', parentUrl);
    const parentRes = await this.request(config, parentUrl, { method: 'GET' });
    const parentJson = (await parentRes.json()) as {
      key?: string;
      fields?: {
        summary?: string;
        issuetype?: { name?: string };
        status?: { name?: string };
      };
    };
    const parent = {
      key: String(parentJson.key ?? parentKey),
      summary: String(parentJson.fields?.summary ?? ''),
      issueType: String(parentJson.fields?.issuetype?.name ?? ''),
      status: String(parentJson.fields?.status?.name ?? ''),
    };

    // 자식 검색 — 일반 자식(parent) + Epic Link 호환(classic Jira Epic→Story).
    // 일부 인스턴스는 "Epic Link" field name 을 지원하지 않으므로 400 응답 시 fallback.
    const searchUrl = `${config.baseUrl}/rest/api/3/search/jql`;
    const escapedKey = parentKey.replace(/"/g, '');
    const primaryJql = `parent = "${escapedKey}" OR "Epic Link" = "${escapedKey}"`;
    const fallbackJql = `parent = "${escapedKey}"`;
    const fields = ['summary', 'status', 'issuetype'];

    const runSearch = async (jql: string) => {
      LOG('getIssueChildren jql=', jql);
      const res = await this.request(config, searchUrl, {
        method: 'POST',
        body: JSON.stringify({ jql, maxResults: 100, fields }),
      });
      return (await res.json()) as {
        issues?: Array<{
          key?: string;
          fields?: {
            summary?: string;
            status?: { name?: string };
            issuetype?: { name?: string };
          };
        }>;
      };
    };

    let json: Awaited<ReturnType<typeof runSearch>>;
    try {
      json = await runSearch(primaryJql);
    } catch (err) {
      // Epic Link field 미지원 인스턴스(400) 시 parent 단독으로 재시도.
      const msg = err instanceof Error ? err.message : String(err);
      if (/\b400\b/.test(msg) || /Epic Link/i.test(msg)) {
        LOG('Epic Link JQL rejected, retrying with parent only');
        json = await runSearch(fallbackJql);
      } else {
        throw err;
      }
    }
    const children = (json.issues ?? []).map((i) => ({
      key: String(i.key ?? ''),
      summary: String(i.fields?.summary ?? ''),
      issueType: String(i.fields?.issuetype?.name ?? ''),
      status: String(i.fields?.status?.name ?? ''),
    }));
    return { parent, children };
  }

  async getTransitions(
    config: JiraConfig,
    issueKey: string,
  ): Promise<Array<{ id: string; name: string; to: string }>> {
    const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`;
    LOG('GET transitions', url);
    const res = await this.request(config, url, { method: 'GET' });
    const json = (await res.json()) as {
      transitions?: Array<{
        id?: string;
        name?: string;
        to?: { name?: string };
      }>;
    };
    return (json.transitions ?? []).map((t) => ({
      id: String(t.id ?? ''),
      name: String(t.name ?? ''),
      to: String(t.to?.name ?? ''),
    }));
  }

  async transitionIssue(
    config: JiraConfig,
    issueKey: string,
    transitionId: string,
  ): Promise<void> {
    const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`;
    const body = { transition: { id: transitionId } };
    LOG('POST transition', issueKey, 'transitionId=', transitionId);
    await this.request(config, url, {
      method: 'POST',
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
