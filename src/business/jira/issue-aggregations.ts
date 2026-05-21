import type { NormalizedIssue } from '../../server-state/jira';

export type DashboardSummary = {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  newThisWeek: number;
};

export type DistributionEntry = { label: string; count: number };
export type DueIssue = NormalizedIssue & { dueDate: string };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function summarizeIssues(issues: NormalizedIssue[]): DashboardSummary {
  const now = Date.now();
  const weekAgo = now - 7 * MS_PER_DAY;
  let todo = 0;
  let inProgress = 0;
  let done = 0;
  let newThisWeek = 0;
  for (const i of issues) {
    if (i.statusCategory === 'done') done += 1;
    else if (i.statusCategory === 'indeterminate') inProgress += 1;
    else todo += 1;
    const createdAt = Date.parse(i.created);
    if (Number.isFinite(createdAt) && createdAt >= weekAgo) newThisWeek += 1;
  }
  return { total: issues.length, todo, inProgress, done, newThisWeek };
}

export function distributionBy<K extends keyof NormalizedIssue>(
  issues: NormalizedIssue[],
  key: K,
  fallback = '(없음)',
): DistributionEntry[] {
  const map = new Map<string, number>();
  for (const i of issues) {
    const raw = i[key];
    const label = raw == null || raw === '' ? fallback : String(raw);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count,
  );
}

/** Issues due within the next `days` days, sorted soonest first. */
export function dueWithin(issues: NormalizedIssue[], days: number): DueIssue[] {
  const now = Date.now();
  const limit = now + days * MS_PER_DAY;
  return issues
    .filter((i): i is DueIssue => {
      if (!i.dueDate) return false;
      const t = Date.parse(i.dueDate);
      if (!Number.isFinite(t)) return false;
      // Include slightly overdue items (within 1 day past) so the user still sees them.
      return t >= now - MS_PER_DAY && t <= limit && i.statusCategory !== 'done';
    })
    .sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate));
}

export function workloadByAssignee(issues: NormalizedIssue[]): DistributionEntry[] {
  return distributionBy(
    issues.filter((i) => i.statusCategory !== 'done'),
    'assignee',
    '미할당',
  );
}
