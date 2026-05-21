import type { NormalizedIssue } from '../../server-state/jira';

export type TimelineRow = {
  issue: NormalizedIssue;
  startMs: number;
  endMs: number;
  /** True when neither startDate nor dueDate was present and we synthesized one. */
  synthesized: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Build timeline rows from issues. Rules:
 *   - startDate → start; otherwise created.
 *   - dueDate   → end; otherwise updated (or start + 1 day).
 *   - Skip issues with no useful dates at all.
 */
export function buildTimelineRows(issues: NormalizedIssue[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const issue of issues) {
    const startCandidate = issue.startDate ?? issue.created;
    const endCandidate =
      issue.dueDate ?? (issue.statusCategory === 'done' ? issue.updated : null);
    const startMs = parseMs(startCandidate);
    let endMs = parseMs(endCandidate);
    if (!Number.isFinite(startMs) && !Number.isFinite(endMs)) continue;
    const safeStart = Number.isFinite(startMs) ? startMs : (endMs as number) - MS_PER_DAY;
    if (!Number.isFinite(endMs)) endMs = safeStart + MS_PER_DAY;
    const synthesized = !issue.startDate || !issue.dueDate;
    rows.push({
      issue,
      startMs: Math.min(safeStart, endMs as number),
      endMs: Math.max(safeStart, endMs as number),
      synthesized,
    });
  }
  return rows.sort((a, b) => a.startMs - b.startMs);
}

export function timelineBounds(rows: TimelineRow[]): { startMs: number; endMs: number } {
  if (rows.length === 0) {
    const now = Date.now();
    return { startMs: now - 14 * MS_PER_DAY, endMs: now + 14 * MS_PER_DAY };
  }
  const startMs = Math.min(...rows.map((r) => r.startMs));
  const endMs = Math.max(...rows.map((r) => r.endMs));
  const pad = Math.max(MS_PER_DAY, (endMs - startMs) * 0.05);
  return { startMs: startMs - pad, endMs: endMs + pad };
}

function parseMs(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.NaN;
}
