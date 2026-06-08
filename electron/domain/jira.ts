import type { JiraIssue } from '../contracts/jira';

/**
 * Pure helpers around Jira issues. Domain layer must not import electron/fs/http.
 */

export type JiraConfig = {
  baseUrl: string; // https://your-domain.atlassian.net
  email: string;
  token: string;
  projectKeys: string[]; // one or more project keys
};

export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

/** Split a comma/space-separated project key field into a deduped array. */
export function parseProjectKeys(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

/** `project = "X"` / `project in ("X", "Y")` clause shared by every search. */
export function buildProjectScopeClause(projectKeys: string[]): string {
  const quoted = projectKeys.map((k) => `"${k.replace(/"/g, '')}"`).join(', ');
  return projectKeys.length === 1 ? `project = ${quoted}` : `project in (${quoted})`;
}

export function buildSearchJql(projectKeys: string[]): string {
  return `${buildProjectScopeClause(projectKeys)} AND assignee = currentUser() ORDER BY updated DESC`;
}

/** Free-text search within the configured projects (summary match + key match). */
export function buildTextSearchJql(projectKeys: string[], text: string): string {
  const scope = buildProjectScopeClause(projectKeys);
  const esc = text.replace(/["\\]/g, '').trim();
  const clauses: string[] = [];
  if (esc) {
    clauses.push(`summary ~ "${esc}*"`);
    // If the text looks like an issue key, match it exactly too.
    if (/^[A-Za-z][A-Za-z0-9]+-\d+$/.test(esc)) {
      clauses.push(`key = "${esc.toUpperCase()}"`);
    }
  }
  const where = clauses.length > 0 ? ` AND (${clauses.join(' OR ')})` : '';
  return `${scope}${where} ORDER BY updated DESC`;
}

/** Epics in a single project, newest first. */
export function buildEpicSearchJql(projectKey: string): string {
  const key = projectKey.replace(/"/g, '');
  return `project = "${key}" AND issuetype = Epic ORDER BY created DESC`;
}

/** Map raw Atlassian REST issue object → our narrowed projection. */
export function mapAtlassianIssue(raw: AtlassianIssue, baseUrl: string): JiraIssue {
  const fields = raw.fields ?? {};
  return {
    id: String(raw.id ?? ''),
    key: String(raw.key ?? ''),
    summary: String(fields.summary ?? ''),
    status: String(fields.status?.name ?? ''),
    statusCategory: String(fields.status?.statusCategory?.key ?? ''),
    priority: fields.priority?.name ?? null,
    issueType: String(fields.issuetype?.name ?? ''),
    assignee: fields.assignee?.displayName ?? null,
    reporter: fields.reporter?.displayName ?? null,
    created: String(fields.created ?? ''),
    updated: String(fields.updated ?? ''),
    url: `${baseUrl}/browse/${raw.key}`,
  };
}

// Loose shape we accept from the wire — only fields we read are typed.
export type AtlassianIssue = {
  id?: string | number;
  key?: string;
  fields?: {
    summary?: string;
    status?: { name?: string; statusCategory?: { key?: string } };
    priority?: { name?: string };
    issuetype?: { name?: string };
    assignee?: { displayName?: string } | null;
    reporter?: { displayName?: string } | null;
    created?: string;
    updated?: string;
  };
};
