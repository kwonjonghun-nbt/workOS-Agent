/**
 * NormalizedIssue is the snapshot-friendly projection of a Jira issue. It
 * carries enough fields for the local dashboard / timeline / stats / label
 * tooling without ever touching ADF descriptions or attachments.
 *
 * Domain rules:
 *  - all string fields are non-null (use '' for missing); nullable values are
 *    only allowed where the renderer cares about "absent" semantics (priority,
 *    assignee, dueDate, etc.).
 *  - dates are ISO-8601 strings as Jira returns them — never converted to ms.
 */
export type NormalizedIssue = {
  id: string;
  key: string;
  summary: string;
  status: string;
  statusCategory: string; // 'new' | 'indeterminate' | 'done' | ''
  priority: string | null;
  issueType: string;
  assignee: string | null;
  assigneeEmail: string | null;
  reporter: string | null;
  created: string;
  updated: string;
  url: string;
  labels: string[];
  dueDate: string | null;
  startDate: string | null;
  storyPoints: number | null;
  parentKey: string | null;
};

/** Raw Atlassian payload — only fields we read are typed. */
export type AtlassianIssueRaw = {
  id?: string | number;
  key?: string;
  fields?: {
    summary?: string;
    status?: { name?: string; statusCategory?: { key?: string } };
    priority?: { name?: string };
    issuetype?: { name?: string };
    assignee?: { displayName?: string; emailAddress?: string } | null;
    reporter?: { displayName?: string } | null;
    created?: string;
    updated?: string;
    labels?: string[];
    duedate?: string | null;
    parent?: { key?: string } | null;
    // Jira customfields for story points / start date vary per tenant. We probe
    // the common ones and fall back to null.
    customfield_10016?: number | null;
    customfield_10004?: number | null;
    customfield_10015?: string | null; // start date (common)
    [extra: string]: unknown;
  };
};

const STORY_POINT_KEYS = ['customfield_10016', 'customfield_10004'] as const;
const START_DATE_KEYS = ['customfield_10015', 'customfield_10100'] as const;

export function normalizeAtlassianIssue(
  raw: AtlassianIssueRaw,
  baseUrl: string,
): NormalizedIssue {
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
    assigneeEmail: fields.assignee?.emailAddress ?? null,
    reporter: fields.reporter?.displayName ?? null,
    created: String(fields.created ?? ''),
    updated: String(fields.updated ?? ''),
    url: `${baseUrl}/browse/${raw.key}`,
    labels: Array.isArray(fields.labels) ? fields.labels.map(String) : [],
    dueDate: fields.duedate ?? null,
    startDate: pickFirstString(fields, START_DATE_KEYS),
    storyPoints: pickFirstNumber(fields, STORY_POINT_KEYS),
    parentKey: fields.parent?.key ?? null,
  };
}

function pickFirstNumber(
  fields: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const k of keys) {
    const v = fields[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function pickFirstString(
  fields: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const k of keys) {
    const v = fields[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

/** Fields list we ask Atlassian to return when fetching for snapshot. */
export const SNAPSHOT_FIELDS: string[] = [
  'summary',
  'status',
  'priority',
  'issuetype',
  'assignee',
  'reporter',
  'created',
  'updated',
  'labels',
  'duedate',
  'parent',
  ...STORY_POINT_KEYS,
  ...START_DATE_KEYS,
];
