import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { jiraKeys, jiraQueries } from '../../../server-state/jira';
import type { JiraIssue } from '../../../server-state/jira';
import { useIssueModalStore } from '../../../business/jira/issue-modal-store';

/**
 * Renders the Jira issues currently assigned to the configured account,
 * plus a few at-a-glance metrics derived from the same data.
 */
export function JiraTaskList() {
  const [maxResults] = useState(50);
  const queryClient = useQueryClient();
  const query = useQuery(jiraQueries.myIssues(maxResults));

  const metrics = useMemo(() => deriveMetrics(query.data?.issues ?? []), [query.data]);

  const refresh = () => {
    console.log('[jira] refresh requested; invalidating jira cache');
    void queryClient
      .invalidateQueries({ queryKey: jiraKeys.all })
      .then(() => console.log('[jira] refresh: cache invalidated'));
  };

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wider text-ink-400">
            내 지라 테스크
          </span>
          {query.dataUpdatedAt > 0 && (
            <span className="text-[10px] text-ink-500">
              마지막 갱신 · {new Date(query.dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={query.isFetching}
          className="rounded border border-ink-700 px-2 py-0.5 text-[11px] text-ink-300 hover:bg-ink-850 disabled:opacity-50"
        >
          {query.isFetching ? '갱신 중…' : '↻ 새로고침'}
        </button>
      </header>

      {query.isError ? (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-[11px] text-rose-300">
          <div className="font-semibold">Jira 이슈를 불러오지 못했습니다.</div>
          <div className="mt-1 break-all">{(query.error as Error).message}</div>
          <div className="mt-1 text-rose-300/80">
            설정 페이지의 「연결 테스트」로 baseUrl/이메일/토큰을 점검해주세요.
          </div>
        </div>
      ) : (
        <>
          <Metrics metrics={metrics} />

          {query.isLoading ? (
            <div className="text-xs text-ink-500">불러오는 중…</div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {(query.data?.issues ?? []).map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))}
              {query.data && query.data.issues.length === 0 && (
                <li className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200">
                  표시할 이슈가 없습니다. 응답은 정상이지만 다음 조건이 모두 매치되는 이슈가 없습니다:
                  <ul className="mt-1 list-disc pl-4 text-amber-300/90">
                    <li><code>project in (...)</code> — 설정된 프로젝트 키</li>
                    <li><code>assignee = currentUser()</code> — 설정한 이메일 계정에 담당이 걸린 이슈</li>
                  </ul>
                  <div className="mt-1">설정 페이지의 「연결 테스트」로 baseUrl/계정/JQL 매치 수를 확인하세요.</div>
                </li>
              )}
            </ul>
          )}
        </>
      )}

      <div className="rounded border border-ink-800 bg-ink-900/40 p-2 text-[10px] text-ink-500">
        debug · status={query.status}, fetching={String(query.isFetching)}, error={query.error ? '!' : '–'}, issues={query.data?.issues.length ?? '-'}
      </div>
    </div>
  );
}

type Metrics = {
  total: number;
  inProgress: number;
  done: number;
  todo: number;
  byPriority: Record<string, number>;
};

function deriveMetrics(issues: JiraIssue[]): Metrics {
  const byPriority: Record<string, number> = {};
  let inProgress = 0;
  let done = 0;
  let todo = 0;
  for (const i of issues) {
    const p = i.priority ?? 'None';
    byPriority[p] = (byPriority[p] ?? 0) + 1;
    if (i.statusCategory === 'done') done += 1;
    else if (i.statusCategory === 'indeterminate') inProgress += 1;
    else todo += 1;
  }
  return { total: issues.length, inProgress, done, todo, byPriority };
}

function Metrics({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <Stat label="전체" value={metrics.total} />
      <Stat label="해야 할 일" value={metrics.todo} />
      <Stat label="진행 중" value={metrics.inProgress} />
      <Stat label="완료" value={metrics.done} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-ink-800 bg-ink-900/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="text-base font-semibold text-ink-100">{value}</div>
    </div>
  );
}

function IssueRow({ issue }: { issue: JiraIssue }) {
  const statusTone = statusToneFor(issue.statusCategory);
  const openIssue = useIssueModalStore((s) => s.open);
  return (
    <li
      className="cursor-pointer rounded border border-ink-800 bg-ink-900/60 px-2 py-1.5 text-xs hover:border-ink-700 hover:bg-ink-850/60"
      onClick={() => openIssue(issue.key)}
    >
      <div className="flex items-center gap-2">
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[11px] text-claude-300 hover:underline"
        >
          {issue.key}
        </a>
        <span className={`rounded px-1 py-0.5 text-[10px] ${statusTone}`}>{issue.status}</span>
        {issue.priority && (
          <span className="rounded bg-ink-800 px-1 py-0.5 text-[10px] text-ink-400">
            {issue.priority}
          </span>
        )}
      </div>
      <div className="mt-1 truncate text-ink-100">{issue.summary}</div>
      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-ink-500">
        <span>{issue.issueType}</span>
        {issue.assignee && <span>· {issue.assignee}</span>}
        <span className="ml-auto">{formatDate(issue.updated)}</span>
      </div>
    </li>
  );
}

function statusToneFor(category: string): string {
  if (category === 'done') return 'bg-emerald-500/15 text-emerald-300';
  if (category === 'indeterminate') return 'bg-amber-500/15 text-amber-300';
  return 'bg-ink-800 text-ink-400';
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}
