import { useMemo, useState } from 'react';
import type { NormalizedIssue } from '../../../../server-state/jira';
import {
  buildTimelineRows,
  timelineBounds,
  type TimelineRow,
} from '../../../../business/jira/timeline-rows';
import { useIssueModalStore } from '../../../../business/jira/issue-modal-store';

type Props = { issues: NormalizedIssue[] };

type Zoom = 'day' | 'week' | 'month';
const ZOOM_PIXELS_PER_DAY: Record<Zoom, number> = {
  day: 60,
  week: 24,
  month: 8,
};
const ROW_HEIGHT = 28;
const LABEL_WIDTH = 220;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function TimelineTab({ issues }: Props) {
  const [zoom, setZoom] = useState<Zoom>('week');
  const [hideDone, setHideDone] = useState(true);

  const filtered = useMemo(
    () => (hideDone ? issues.filter((i) => i.statusCategory !== 'done') : issues),
    [issues, hideDone],
  );

  const rows = useMemo(() => buildTimelineRows(filtered), [filtered]);
  const bounds = useMemo(() => timelineBounds(rows), [rows]);
  const ppd = ZOOM_PIXELS_PER_DAY[zoom];
  const totalDays = Math.max(1, Math.ceil((bounds.endMs - bounds.startMs) / MS_PER_DAY));
  const totalWidth = totalDays * ppd;
  const openIssue = useIssueModalStore((s) => s.open);

  const dayTicks = useMemo(() => {
    const ticks: { ms: number; label: string; major: boolean }[] = [];
    const first = startOfDay(bounds.startMs);
    for (let t = first; t <= bounds.endMs; t += MS_PER_DAY) {
      const d = new Date(t);
      const isMonday = d.getDay() === 1;
      const isFirst = d.getDate() === 1;
      const isMajor = zoom === 'day' || isMonday || (zoom === 'month' && isFirst);
      ticks.push({
        ms: t,
        label:
          zoom === 'month'
            ? isFirst
              ? `${d.getMonth() + 1}월`
              : ''
            : `${d.getMonth() + 1}/${d.getDate()}`,
        major: isMajor,
      });
    }
    return ticks;
  }, [bounds, zoom]);

  const nowOffset = ((Date.now() - bounds.startMs) / MS_PER_DAY) * ppd;

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded border border-ink-800 bg-ink-900/60 p-0.5">
          {(['day', 'week', 'month'] as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={`rounded px-2 py-1 text-[11px] ${
                zoom === z ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              {z === 'day' ? '일' : z === 'week' ? '주' : '월'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-ink-300">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="accent-claude-500"
          />
          완료 숨기기
        </label>
        <div className="ml-auto text-[10px] text-ink-500">
          {rows.length}개 이슈 · {totalDays}일 범위
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded border border-dashed border-ink-700 bg-ink-900/40 p-8 text-center text-xs text-ink-500">
          표시할 이슈가 없습니다. (시작일/마감일이 모두 비어있는 이슈는 제외됩니다)
        </div>
      ) : (
        <div className="overflow-auto rounded border border-ink-800 bg-ink-900/40">
          <div
            className="relative"
            style={{ width: LABEL_WIDTH + totalWidth }}
          >
            {/* Header row */}
            <div
              className="sticky top-0 z-10 flex border-b border-ink-800 bg-ink-900"
              style={{ height: 28 }}
            >
              <div
                className="shrink-0 border-r border-ink-800 px-2 py-1.5 text-[10px] uppercase tracking-wider text-ink-500"
                style={{ width: LABEL_WIDTH }}
              >
                이슈
              </div>
              <div className="relative" style={{ width: totalWidth }}>
                {dayTicks
                  .filter((t) => t.major)
                  .map((t) => (
                    <div
                      key={t.ms}
                      className="absolute top-0 h-full border-l border-ink-800 px-1 text-[10px] text-ink-400"
                      style={{
                        left: ((t.ms - bounds.startMs) / MS_PER_DAY) * ppd,
                      }}
                    >
                      {t.label}
                    </div>
                  ))}
              </div>
            </div>

            {/* Vertical grid lines + today */}
            <div
              className="pointer-events-none absolute top-7"
              style={{
                left: LABEL_WIDTH,
                width: totalWidth,
                height: rows.length * ROW_HEIGHT,
              }}
            >
              {dayTicks.map((t) => (
                <div
                  key={t.ms}
                  className={`absolute top-0 h-full border-l ${
                    t.major ? 'border-ink-800' : 'border-ink-900'
                  }`}
                  style={{
                    left: ((t.ms - bounds.startMs) / MS_PER_DAY) * ppd,
                  }}
                />
              ))}
              {nowOffset >= 0 && nowOffset <= totalWidth && (
                <div
                  className="absolute top-0 h-full w-px bg-claude-400"
                  style={{ left: nowOffset }}
                />
              )}
            </div>

            {/* Rows */}
            {rows.map((row, idx) => (
              <Row
                key={row.issue.id}
                row={row}
                idx={idx}
                bounds={bounds}
                ppd={ppd}
                onOpen={() => openIssue(row.issue.key)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  row,
  idx,
  bounds,
  ppd,
  onOpen,
}: {
  row: TimelineRow;
  idx: number;
  bounds: { startMs: number; endMs: number };
  ppd: number;
  onOpen: () => void;
}) {
  const left = ((row.startMs - bounds.startMs) / MS_PER_DAY) * ppd;
  const width = Math.max(4, ((row.endMs - row.startMs) / MS_PER_DAY) * ppd);
  const tone =
    row.issue.statusCategory === 'done'
      ? 'bg-emerald-500/35 border-emerald-500/60'
      : row.issue.statusCategory === 'indeterminate'
        ? 'bg-amber-500/35 border-amber-500/60'
        : 'bg-sky-500/35 border-sky-500/60';
  return (
    <div
      className="flex border-b border-ink-900/80 hover:bg-ink-900/40"
      style={{ height: ROW_HEIGHT }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 truncate border-r border-ink-800 px-2 text-left text-xs text-ink-200 hover:text-claude-300"
        style={{ width: LABEL_WIDTH }}
        title={row.issue.summary}
      >
        <span className="font-mono text-[10px] text-claude-400">
          {row.issue.key}
        </span>{' '}
        {row.issue.summary}
      </button>
      <div className="relative flex-1" style={{ minHeight: ROW_HEIGHT }}>
        <button
          type="button"
          onClick={onOpen}
          className={`absolute top-1.5 cursor-pointer truncate rounded border px-1.5 text-[10px] text-ink-100 ${tone} ${
            row.synthesized ? 'border-dashed opacity-80' : ''
          }`}
          style={{ left, width, height: ROW_HEIGHT - 12 }}
          title={`${row.issue.key} · ${row.issue.status}`}
        >
          {row.issue.status}
        </button>
      </div>
      <span className="sr-only">row {idx}</span>
    </div>
  );
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
