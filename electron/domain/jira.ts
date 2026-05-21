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

export function buildSearchJql(projectKeys: string[]): string {
  const quoted = projectKeys.map((k) => `"${k.replace(/"/g, '')}"`).join(', ');
  const projectClause =
    projectKeys.length === 1 ? `project = ${quoted}` : `project in (${quoted})`;
  return `${projectClause} AND assignee = currentUser() ORDER BY updated DESC`;
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
