import { useMemo, useState } from 'react';

type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'hr' };

type Section = {
  id: string;
  number: string | null;
  title: string;
  blocks: Block[];
};

export function ReportVisualView({ content }: { content: string }) {
  const sections = useMemo(() => parseReport(content), [content]);
  const [activeId, setActiveId] = useState<string | null>(
    sections[1]?.id ?? sections[0]?.id ?? null,
  );

  if (sections.length === 0) {
    return (
      <div className="rounded border border-dashed border-ink-700 bg-ink-900/40 p-8 text-center text-xs text-ink-500">
        리포트 내용이 비어 있습니다.
      </div>
    );
  }

  const header = sections.find((s) => s.number === null);
  const numbered = sections.filter((s) => s.number !== null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-0 flex flex-col gap-1">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-ink-500">
            목차
          </div>
          {numbered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActiveId(s.id);
                document
                  .getElementById(s.id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`rounded px-2 py-1 text-left text-[11px] leading-tight transition ${
                activeId === s.id
                  ? 'bg-claude-500/15 text-claude-200'
                  : 'text-ink-400 hover:bg-ink-850 hover:text-ink-200'
              }`}
            >
              <span className="text-ink-500">{s.number}.</span> {s.title}
            </button>
          ))}
        </nav>
      </aside>

      <article className="min-w-0 space-y-4">
        {header && <ReportHeader section={header} />}
        {numbered.map((s) => (
          <SectionCard key={s.id} section={s} />
        ))}
      </article>
    </div>
  );
}

function ReportHeader({ section }: { section: Section }) {
  return (
    <header className="rounded border border-ink-800 bg-gradient-to-br from-claude-500/10 via-ink-900 to-ink-900 p-5">
      <h1 className="text-lg font-semibold text-ink-50">{section.title}</h1>
      {section.blocks
        .filter((b) => b.kind === 'quote' || b.kind === 'paragraph')
        .slice(0, 3)
        .map((b, i) => (
          <p
            key={i}
            className={`mt-2 text-[12px] leading-relaxed ${
              b.kind === 'quote' ? 'text-ink-300' : 'text-ink-200'
            }`}
          >
            {renderInline(b.kind === 'quote' ? b.text : b.text)}
          </p>
        ))}
    </header>
  );
}

function SectionCard({ section }: { section: Section }) {
  const numeric = section.number === '1';
  return (
    <section
      id={section.id}
      className="scroll-mt-4 rounded border border-ink-800 bg-ink-900/60 p-4"
    >
      <header className="mb-3 flex items-baseline gap-2 border-b border-ink-800 pb-2">
        <span className="rounded bg-claude-500/15 px-2 py-0.5 text-[10px] font-medium text-claude-200">
          {section.number}
        </span>
        <h2 className="text-sm font-semibold text-ink-100">{section.title}</h2>
      </header>
      {numeric ? <MetricsSection section={section} /> : <DefaultSection section={section} />}
    </section>
  );
}

function MetricsSection({ section }: { section: Section }) {
  const out: JSX.Element[] = [];
  let lastH3: string | null = null;

  for (let i = 0; i < section.blocks.length; i++) {
    const b = section.blocks[i];
    if (b.kind === 'h3') {
      lastH3 = b.text;
      out.push(
        <h3 key={`h3-${i}`} className="mt-3 text-[12px] font-medium text-ink-200">
          {b.text}
        </h3>,
      );
      continue;
    }
    if (b.kind === 'table') {
      const isSummary = !lastH3 && b.headers[0] === '항목';
      if (isSummary) {
        out.push(<SummaryGrid key={`sum-${i}`} table={b} />);
      } else {
        out.push(<BreakdownChart key={`bd-${i}`} title={lastH3 ?? ''} table={b} />);
      }
      continue;
    }
    if (b.kind === 'quote' || b.kind === 'paragraph') {
      out.push(
        <p
          key={`p-${i}`}
          className={`mt-2 text-[11px] ${
            b.kind === 'quote'
              ? 'rounded border-l-2 border-claude-500/60 bg-ink-900 px-3 py-2 text-ink-300'
              : 'text-ink-200'
          }`}
        >
          {renderInline(b.text)}
        </p>,
      );
    }
  }
  return <div className="flex flex-col gap-2">{out}</div>;
}

function SummaryGrid({ table }: { table: Extract<Block, { kind: 'table' }> }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {table.rows.map((r, i) => {
        const label = r[0] ?? '';
        const value = r[1] ?? '';
        const tone = toneFor(label);
        return (
          <div
            key={i}
            className={`rounded border border-ink-800 bg-ink-950/60 p-3 ${tone.ring}`}
          >
            <div className="text-[10px] uppercase tracking-wide text-ink-500">
              {label}
            </div>
            <div className={`mt-1 text-lg font-semibold ${tone.text}`}>
              {renderInline(value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BreakdownChart({
  title,
  table,
}: {
  title: string;
  table: Extract<Block, { kind: 'table' }>;
}) {
  // Expect: [name, total, done, rate]
  const rows = table.rows
    .map((r) => {
      const name = r[0] ?? '';
      const total = numFrom(r[1] ?? '');
      const done = numFrom(r[2] ?? '');
      const rate = pctFrom(r[3] ?? '');
      return { name, total, done, rate };
    })
    .sort((a, b) => b.total - a.total);

  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="rounded border border-ink-800 bg-ink-950/40 p-3">
      <div className="mb-2 text-[11px] font-medium text-ink-300">{title}</div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => {
          const totalPct = (r.total / maxTotal) * 100;
          const donePct = r.total > 0 ? (r.done / r.total) * 100 : 0;
          return (
            <div key={i} className="grid grid-cols-[1fr_minmax(0,3fr)_56px] items-center gap-2">
              <div className="truncate text-[11px] text-ink-200" title={r.name}>
                {r.name}
              </div>
              <div className="relative h-4 overflow-hidden rounded bg-ink-900">
                <div
                  className="absolute inset-y-0 left-0 bg-ink-700"
                  style={{ width: `${totalPct}%` }}
                  title={`전체 ${r.total}`}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-claude-500/80"
                  style={{ width: `${(donePct / 100) * totalPct}%` }}
                  title={`완료 ${r.done} (${r.rate.toFixed(1)}%)`}
                />
                <div className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-mono text-ink-100">
                  {r.done}/{r.total}
                </div>
              </div>
              <div className="text-right text-[10px] font-mono text-claude-200">
                {Number.isFinite(r.rate) ? `${r.rate.toFixed(1)}%` : '-'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DefaultSection({ section }: { section: Section }) {
  return (
    <div className="flex flex-col gap-2">
      {section.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'h3':
      return (
        <h3 className="mt-2 text-[12px] font-medium text-claude-200">
          {block.text}
        </h3>
      );
    case 'quote':
      return (
        <blockquote className="rounded border-l-2 border-claude-500/50 bg-ink-950/60 px-3 py-2 text-[11px] text-ink-300">
          {renderInline(block.text)}
        </blockquote>
      );
    case 'paragraph':
      return (
        <p className="text-[12px] leading-relaxed text-ink-200">
          {renderInline(block.text)}
        </p>
      );
    case 'ul':
      return (
        <ul className="ml-3 list-disc space-y-1 text-[12px] text-ink-200 marker:text-claude-300">
          {block.items.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ul>
      );
    case 'table':
      return <PrettyTable headers={block.headers} rows={block.rows} />;
    case 'hr':
      return <hr className="my-2 border-ink-800" />;
    default:
      return null;
  }
}

function PrettyTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded border border-ink-800">
      <table className="w-full text-[11px]">
        <thead className="bg-ink-900/80">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="border-b border-ink-800 px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-ink-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="even:bg-ink-900/30">
              {r.map((c, j) => (
                <td
                  key={j}
                  className="border-b border-ink-900 px-2 py-1.5 align-top text-ink-200"
                >
                  {renderInline(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- inline markdown ----------------------------------------------------------

function renderInline(text: string): JSX.Element {
  const parts: (string | JSX.Element)[] = [];
  // bold + code + ticket keys (UPPER-123)
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\b[A-Z][A-Z0-9]{1,9}-\d+\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      parts.push(
        <strong key={k++} className="font-semibold text-ink-50">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith('`')) {
      parts.push(
        <code key={k++} className="rounded bg-ink-950 px-1 py-0.5 font-mono text-[10px] text-claude-200">
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(
        <span key={k++} className="rounded bg-claude-500/10 px-1 py-0.5 font-mono text-[10px] text-claude-200">
          {tok}
        </span>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// --- parser -------------------------------------------------------------------

function parseReport(src: string): Section[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const sections: Section[] = [];
  let cur: Section | null = null;
  const pushCur = () => {
    if (cur) sections.push(cur);
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // H1 — overall title
    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1) {
      pushCur();
      cur = { id: 'title', number: null, title: h1[1].trim(), blocks: [] };
      i++;
      continue;
    }

    // H2 — sections (possibly numbered "N. title")
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      pushCur();
      const t = h2[1].trim();
      const numMatch = /^(\d+)\.\s*(.+)$/.exec(t);
      cur = {
        id: numMatch ? `sec-${numMatch[1]}` : `h-${sections.length}`,
        number: numMatch ? numMatch[1] : null,
        title: numMatch ? numMatch[2] : t,
        blocks: [],
      };
      i++;
      continue;
    }

    // Ensure container
    if (!cur) {
      cur = { id: 'preamble', number: null, title: '', blocks: [] };
    }

    // H3
    const h3 = /^###\s+(.*)$/.exec(line);
    if (h3) {
      cur.blocks.push({ kind: 'h3', text: h3[1].trim() });
      i++;
      continue;
    }

    // HR
    if (/^---+\s*$/.test(line)) {
      cur.blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    // Quote
    if (line.startsWith('>')) {
      const buf: string[] = [line.replace(/^>\s?/, '')];
      i++;
      while (i < lines.length && lines[i].startsWith('>')) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      cur.blocks.push({ kind: 'quote', text: buf.join(' ').trim() });
      continue;
    }

    // Table
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|[\s\-|:]+\|\s*$/.test(lines[i + 1])) {
      const headers = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      cur.blocks.push({ kind: 'table', headers, rows });
      continue;
    }

    // UL
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, '').trim());
        i++;
      }
      cur.blocks.push({ kind: 'ul', items });
      continue;
    }

    // Blank
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — collect until blank/heading/structure
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^>/.test(lines[i]) &&
      !/^\|.*\|\s*$/.test(lines[i]) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    cur.blocks.push({ kind: 'paragraph', text: buf.join(' ').trim() });
  }
  pushCur();
  return sections;
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());
}

// --- utils --------------------------------------------------------------------

function numFrom(s: string): number {
  const m = /-?\d+(?:\.\d+)?/.exec(s);
  return m ? parseFloat(m[0]) : 0;
}

function pctFrom(s: string): number {
  const m = /(-?\d+(?:\.\d+)?)\s*%/.exec(s);
  return m ? parseFloat(m[1]) : NaN;
}

function toneFor(label: string): { ring: string; text: string } {
  const l = label.toLowerCase();
  if (/완료|done/.test(l)) return { ring: 'ring-1 ring-emerald-500/30', text: 'text-emerald-300' };
  if (/미완료|지연|reject|반려|취소|미착수|backlog/.test(l))
    return { ring: 'ring-1 ring-rose-500/30', text: 'text-rose-300' };
  if (/진행/.test(l)) return { ring: 'ring-1 ring-amber-500/30', text: 'text-amber-300' };
  if (/포인트|story/.test(l)) return { ring: 'ring-1 ring-violet-500/30', text: 'text-violet-300' };
  return { ring: '', text: 'text-ink-100' };
}
