import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  jiraLabelMutations,
  type BulkReplaceResponse,
  type SearchByLabelResponse,
} from '../../../../server-state/jira';
import { useIssueModalStore } from '../../../../business/jira/issue-modal-store';

export function LabelRenameTab() {
  const [projectKey, setProjectKey] = useState('');
  const [oldLabel, setOldLabel] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [foundIssues, setFoundIssues] = useState<SearchByLabelResponse['issues']>(
    [],
  );
  const [bulkResult, setBulkResult] = useState<BulkReplaceResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const openIssue = useIssueModalStore((s) => s.open);

  const search = useMutation({
    ...jiraLabelMutations.searchByLabel(),
    onSuccess: (data) => {
      setFoundIssues(data.issues);
      setSelected(new Set(data.issues.map((i) => i.key)));
      setBulkResult(null);
    },
  });
  const bulk = useMutation({
    ...jiraLabelMutations.bulkReplace(),
    onSuccess: (data) => setBulkResult(data),
  });

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  function runSearch() {
    if (!projectKey.trim() || !oldLabel.trim()) return;
    search.mutate({ projectKey: projectKey.trim(), label: oldLabel.trim() });
  }

  function runBulk() {
    if (selected.size === 0 || !newLabel.trim()) return;
    bulk.mutate({
      issueKeys: Array.from(selected),
      oldLabel: oldLabel.trim(),
      newLabel: newLabel.trim(),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="grid grid-cols-1 gap-2 rounded border border-ink-800 bg-ink-900/60 p-3 sm:grid-cols-3">
        <Field label="프로젝트 키" value={projectKey} onChange={setProjectKey} placeholder="예: AO" />
        <Field label="현재 라벨" value={oldLabel} onChange={setOldLabel} placeholder="예: needs-review" />
        <Field label="새 라벨" value={newLabel} onChange={setNewLabel} placeholder="예: review-needed" />
      </section>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={runSearch}
          disabled={search.isPending || !projectKey.trim() || !oldLabel.trim()}
          className="rounded border border-ink-700 px-3 py-1 text-xs text-ink-200 hover:bg-ink-850 disabled:opacity-50"
        >
          {search.isPending ? '검색 중…' : '🔍 검색'}
        </button>
        <button
          type="button"
          onClick={runBulk}
          disabled={bulk.isPending || selected.size === 0 || !newLabel.trim()}
          className="rounded bg-claude-500 px-3 py-1 text-xs font-medium text-white hover:bg-claude-400 disabled:opacity-50"
        >
          {bulk.isPending
            ? '교체 중…'
            : `↻ 선택 ${selected.size}건 일괄 교체`}
        </button>
      </div>

      {search.isError && (
        <ErrorBox message={(search.error as Error).message} />
      )}
      {bulk.isError && <ErrorBox message={(bulk.error as Error).message} />}

      {bulkResult && (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-[11px] text-emerald-200">
          교체 결과 — 성공 {bulkResult.successKeys.length}건
          {bulkResult.failed.length > 0 && (
            <>
              {' / 실패 '}
              {bulkResult.failed.length}건
              <ul className="mt-1 list-disc pl-4 text-rose-300">
                {bulkResult.failed.map((f) => (
                  <li key={f.key}>
                    {f.key}: {f.error}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {foundIssues.length > 0 && (
        <section>
          <header className="mb-1 flex items-center justify-between text-[11px] text-ink-400">
            <span>검색 결과 ({foundIssues.length}건)</span>
            <button
              type="button"
              onClick={() =>
                setSelected(
                  selected.size === foundIssues.length
                    ? new Set()
                    : new Set(foundIssues.map((i) => i.key)),
                )
              }
              className="text-[10px] text-ink-500 hover:text-ink-200"
            >
              {selected.size === foundIssues.length ? '전체 해제' : '전체 선택'}
            </button>
          </header>
          <ul className="flex flex-col gap-1">
            {foundIssues.map((i) => (
              <li
                key={i.key}
                className="flex items-center gap-2 rounded border border-ink-800 bg-ink-900/60 px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={selected.has(i.key)}
                  onChange={() => toggle(i.key)}
                  className="accent-claude-500"
                />
                <button
                  type="button"
                  onClick={() => openIssue(i.key)}
                  className="font-mono text-[11px] text-claude-300 hover:underline"
                >
                  {i.key}
                </button>
                <span className="truncate text-ink-100">{i.summary}</span>
                <span className="ml-auto rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-400">
                  {i.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-ink-400">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-100 placeholder:text-ink-600"
      />
    </label>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-[11px] text-rose-300">
      {message}
    </div>
  );
}
