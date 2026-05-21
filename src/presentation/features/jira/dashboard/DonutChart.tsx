import type { DistributionEntry } from '../../../../business/jira/issue-aggregations';

const PALETTE = [
  '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa',
  '#f472b6', '#22d3ee', '#a3e635', '#fb923c', '#94a3b8',
  '#fde68a', '#86efac', '#fca5a5', '#c4b5fd', '#67e8f9',
];

type Props = {
  title: string;
  entries: DistributionEntry[];
  size?: number;
};

export function DonutChart({ title, entries, size = 160 }: Props) {
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  const radius = size / 2;
  const inner = radius * 0.62;
  const stroke = radius - inner;
  const cx = radius;
  const cy = radius;

  let cumulative = 0;
  const segments = entries.map((e, idx) => {
    const fraction = total === 0 ? 0 : e.count / total;
    const start = cumulative;
    cumulative += fraction;
    return {
      ...e,
      color: PALETTE[idx % PALETTE.length],
      pathD: arcPath(cx, cy, radius - stroke / 2, start, cumulative),
      fraction,
    };
  });

  return (
    <div className="flex flex-col gap-3 rounded border border-ink-800 bg-ink-900/60 p-3">
      <header className="text-[11px] uppercase tracking-wider text-ink-400">
        {title}
      </header>
      {total === 0 ? (
        <div className="py-6 text-center text-xs text-ink-500">데이터 없음</div>
      ) : (
        <div className="flex items-center gap-3">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {segments.map((seg, idx) => (
              <path
                key={seg.label + idx}
                d={seg.pathD}
                stroke={seg.color}
                strokeWidth={stroke}
                fill="none"
              />
            ))}
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-ink-100"
              fontSize={radius * 0.34}
              fontWeight={600}
            >
              {total}
            </text>
          </svg>
          <ul className="flex flex-1 flex-col gap-1 text-[11px]">
            {segments.map((seg, idx) => (
              <li key={seg.label + idx} className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="truncate text-ink-200">{seg.label}</span>
                <span className="ml-auto text-ink-400">{seg.count}</span>
                <span className="w-10 shrink-0 text-right text-ink-500">
                  {(seg.fraction * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startFraction: number,
  endFraction: number,
): string {
  if (endFraction - startFraction >= 1 - 1e-6) {
    // Full circle — draw as two arcs to avoid SVG degenerate path.
    return [
      `M ${cx + r} ${cy}`,
      `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
      `A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
    ].join(' ');
  }
  const startAngle = startFraction * Math.PI * 2 - Math.PI / 2;
  const endAngle = endFraction * Math.PI * 2 - Math.PI / 2;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endFraction - startFraction > 0.5 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}
