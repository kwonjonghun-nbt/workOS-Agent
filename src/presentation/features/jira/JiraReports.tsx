import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  jiraReportKeys,
  jiraReportMutations,
  jiraReportQueries,
} from '../../../server-state/jira';

export function JiraReports() {
  const queryClient = useQueryClient();
  const listQuery = useQuery(jiraReportQueries.list());
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [draftName, setDraftName] = useState<string>('');
  const [range, setRange] = useState({
    startDate: defaultStart(),
    endDate: defaultEnd(),
  });

  const detailQuery = useQuery({
    ...jiraReportQueries.detail(selected ?? ''),
    enabled: !!selected,
  });

  const generate = useMutation({
    ...jiraReportMutations.generate(),
    onSuccess: (data) => {
      setDraft(data.content);
      const fname = `${range.startDate}_${range.endDate}.md`;
      setDraftName(fname);
      setSelected(null);
    },
  });
  const save = useMutation({
    ...jiraReportMutations.save(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jiraReportKeys.list() });
      setDraft('');
    },
  });
  const remove = useMutation({
    ...jiraReportMutations.delete(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jiraReportKeys.list() });
      setSelected(null);
    },
  });

  const files = listQuery.data?.files ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-3">
        <section className="rounded border border-ink-800 bg-ink-900/60 p-3">
          <header className="mb-2 text-[11px] uppercase tracking-wider text-ink-400">
            새 리포트 생성
          </header>
          <div className="flex flex-col gap-2 text-[11px] text-ink-400">
            <label className="flex flex-col gap-1">
              시작일
              <input
                type="date"
                value={range.startDate}
                onChange={(e) => setRange({ ...range, startDate: e.target.value })}
                className="rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              종료일
              <input
                type="date"
                value={range.endDate}
                onChange={(e) => setRange({ ...range, endDate: e.target.value })}
                className="rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-100"
              />
            </label>
            <button
              type="button"
              onClick={() => generate.mutate(range)}
              disabled={generate.isPending}
              className="mt-1 rounded bg-claude-500 px-3 py-1 text-xs font-medium text-white hover:bg-claude-400 disabled:opacity-50"
            >
              {generate.isPending ? 'LLM 생성 중…' : '🤖 리포트 초안 생성'}
            </button>
            {generate.isError && (
              <span className="text-[10px] text-rose-300">
                {(generate.error as Error).message}
              </span>
            )}
          </div>
        </section>

        <section>
          <header className="mb-1 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-ink-400">
              저장된 리포트 ({files.length})
            </span>
          </header>
          <ul className="flex flex-col gap-1">
            {files.map((f) => (
              <li key={f.filename}>
                <button
                  type="button"
                  onClick={() => {
                    setDraft('');
                    setSelected(f.filename);
                  }}
                  className={`w-full rounded border px-2 py-1.5 text-left text-xs ${
                    selected === f.filename
                      ? 'border-claude-500/60 bg-claude-500/10 text-ink-100'
                      : 'border-ink-800 bg-ink-900/60 text-ink-200 hover:border-ink-700'
                  }`}
                >
                  <div className="truncate">{f.filename}</div>
                  <div className="text-[10px] text-ink-500">
                    {new Date(f.modifiedAt).toLocaleString()} · {formatBytes(f.size)}
                  </div>
                </button>
              </li>
            ))}
            {files.length === 0 && (
              <li className="rounded border border-dashed border-ink-700 bg-ink-900/40 p-3 text-center text-[11px] text-ink-500">
                아직 저장된 리포트가 없습니다.
              </li>
            )}
          </ul>
        </section>
      </aside>

      <main className="min-w-0">
        {draft ? (
          <DraftEditor
            initialName={draftName}
            content={draft}
            onCancel={() => setDraft('')}
            onSave={(filename, content) => save.mutate({ filename, content })}
            saving={save.isPending}
          />
        ) : selected ? (
          <ReportDetailView
            filename={selected}
            content={detailQuery.data?.content ?? ''}
            loading={detailQuery.isLoading}
            onDelete={() => remove.mutate({ filename: selected })}
            deleting={remove.isPending}
          />
        ) : (
          <div className="rounded border border-dashed border-ink-700 bg-ink-900/40 p-12 text-center text-xs text-ink-500">
            왼쪽에서 리포트를 선택하거나 새 리포트를 생성하세요.
          </div>
        )}
      </main>
    </div>
  );
}

function DraftEditor({
  initialName,
  content,
  onCancel,
  onSave,
  saving,
}: {
  initialName: string;
  content: string;
  onCancel: () => void;
  onSave: (filename: string, content: string) => void;
  saving: boolean;
}) {
  const [filename, setFilename] = useState(initialName);
  const [body, setBody] = useState(content);
  const ok = useMemo(() => /^[\w\-. ]+\.md$/.test(filename.trim()), [filename]);

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center gap-2">
        <input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          className="flex-1 rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs font-mono text-ink-100"
        />
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-850"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => onSave(filename.trim(), body)}
          disabled={!ok || saving}
          className="rounded bg-claude-500 px-3 py-1 text-xs font-medium text-white hover:bg-claude-400 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </header>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={28}
        className="flex-1 rounded border border-ink-800 bg-ink-900/60 p-3 font-mono text-xs leading-relaxed text-ink-100"
      />
    </div>
  );
}

function ReportDetailView({
  filename,
  content,
  loading,
  onDelete,
  deleting,
}: {
  filename: string;
  content: string;
  loading: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center gap-2">
        <h2 className="flex-1 truncate font-mono text-sm text-ink-100">{filename}</h2>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded border border-rose-500/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
        >
          {deleting ? '삭제 중…' : '삭제'}
        </button>
      </header>
      {loading ? (
        <div className="py-12 text-center text-xs text-ink-500">불러오는 중…</div>
      ) : (
        <pre className="whitespace-pre-wrap rounded border border-ink-800 bg-ink-900/60 p-4 text-xs leading-relaxed text-ink-100">
          {content}
        </pre>
      )}
    </div>
  );
}

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function defaultEnd(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}
