import { useMemo } from 'react';
import type { NormalizedIssue } from '../../../../server-state/jira';
import { distributionBy } from '../../../../business/jira/issue-aggregations';
import { DonutChart } from './DonutChart';

type Props = { issues: NormalizedIssue[] };

export function StatsTab({ issues }: Props) {
  const byStatus = useMemo(() => distributionBy(issues, 'status'), [issues]);
  const byPriority = useMemo(
    () => distributionBy(issues, 'priority', '(없음)'),
    [issues],
  );
  const byType = useMemo(() => distributionBy(issues, 'issueType'), [issues]);

  const totalPoints = useMemo(
    () =>
      issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
    [issues],
  );
  const issuesWithPoints = useMemo(
    () => issues.filter((i) => i.storyPoints != null).length,
    [issues],
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KPI label="전체 이슈" value={issues.length} />
        <KPI label="총 스토리 포인트" value={totalPoints} />
        <KPI label="포인트 부여 이슈" value={issuesWithPoints} />
        <KPI
          label="평균 포인트"
          value={
            issuesWithPoints === 0
              ? 0
              : Math.round((totalPoints / issuesWithPoints) * 10) / 10
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <DonutChart title="상태별" entries={byStatus} />
        <DonutChart title="우선순위별" entries={byPriority} />
        <DonutChart title="타입별" entries={byType} />
      </section>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-ink-700 bg-ink-900/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div className="text-xl font-semibold text-ink-100">{value}</div>
    </div>
  );
}
