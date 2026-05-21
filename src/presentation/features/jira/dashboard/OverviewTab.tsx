import { useMemo } from 'react';
import type { NormalizedIssue } from '../../../../server-state/jira';
import {
  dueWithin,
  summarizeIssues,
  workloadByAssignee,
  distributionBy,
} from '../../../../business/jira/issue-aggregations';
import { DonutChart } from './DonutChart';

type Props = { issues: NormalizedIssue[] };

export function OverviewTab({ issues }: Props) {
  const summary = useMemo(() => summarizeIssues(issues), [issues]);
  const workload = useMemo(() => workloadByAssignee(issues), [issues]);
  const typeDist = useMemo(
    () => distributionBy(issues, 'issueType', '(타입 없음)'),
    [issues],
  );
  const dueThisWeek = useMemo(() => dueWithin(issues, 7), [issues]);

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard label="전체" value={summary.total} tone="default" />
        <SummaryCard label="해야 할 일" value={summary.todo} tone="todo" />
        <SummaryCard label="진행 중" value={summary.inProgress} tone="progress" />
        <SummaryCard label="완료" value={summary.done} tone="done" />
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DonutChart title="이슈 타입 분포" entries={typeDist} />
        <DonutChart title="담당자 워크로드 (미완료)" entries={workload} />
      </section>

      <section className="rounded border border-ink-800 bg-ink-900/60 p-3">
        <header className="mb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-ink-400">
            이번 주 마감 예정
          </span>
          <span className="text-[10px] text-ink-500">
            {dueThisWeek.length}건
          </span>
        </header>
        {dueThisWeek.length === 0 ? (
          <div className="py-4 text-center text-xs text-ink-500">
            7일 이내 마감 이슈가 없습니다.
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {dueThisWeek.map((i) => (
              <li
                key={i.id}
                className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-ink-850/60"
              >
                <a
                  href={i.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-claude-300 hover:underline"
                >
                  {i.key}
                </a>
                <span className="truncate text-ink-100">{i.summary}</span>
                <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                  {formatDue(i.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'default' | 'todo' | 'progress' | 'done';
}) {
  const accent =
    tone === 'done'
      ? 'border-emerald-500/30 text-emerald-200'
      : tone === 'progress'
        ? 'border-amber-500/30 text-amber-200'
        : tone === 'todo'
          ? 'border-sky-500/30 text-sky-200'
          : 'border-ink-700 text-ink-100';
  return (
    <div
      className={`rounded border ${accent} bg-ink-900/60 px-3 py-2`}
    >
      <div className="text-[10px] uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function formatDue(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const days = Math.round((t - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return `${Math.abs(days)}일 지남`;
  if (days === 0) return '오늘';
  if (days === 1) return '내일';
  return `${days}일 후`;
}
