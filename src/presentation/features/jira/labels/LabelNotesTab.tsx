import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  jiraLabelKeys,
  jiraLabelMutations,
  jiraLabelQueries,
  jiraSnapshotQueries,
  type LabelNote,
} from '../../../../server-state/jira';

export function LabelNotesTab() {
  const queryClient = useQueryClient();
  const notesQuery = useQuery(jiraLabelQueries.notes());
  const latestQuery = useQuery(jiraSnapshotQueries.latest());
  const save = useMutation({
    ...jiraLabelMutations.saveNotes(),
    onSuccess: (next) => {
      queryClient.setQueryData(jiraLabelKeys.notes(), next);
    },
  });

  const [draft, setDraft] = useState<LabelNote[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    if (notesQuery.data) setDraft(notesQuery.data);
  }, [notesQuery.data]);

  const documentedLabels = useMemo(() => new Set(draft.map((d) => d.label)), [draft]);

  const undocumented = useMemo(() => {
    const seen = new Map<string, number>();
    for (const i of latestQuery.data?.issues ?? []) {
      for (const l of i.labels) {
        if (documentedLabels.has(l)) continue;
        seen.set(l, (seen.get(l) ?? 0) + 1);
      }
    }
    return Array.from(seen, ([label, count]) => ({ label, count })).sort(
      (a, b) => b.count - a.count,
    );
  }, [latestQuery.data, documentedLabels]);

  function commitDraft(next: LabelNote[]) {
    setDraft(next);
    save.mutate({ notes: next });
  }

  function addNote() {
    const label = newLabel.trim();
    if (!label) return;
    const next = [
      ...draft,
      { label, description: newDescription.trim(), updatedAt: new Date().toISOString() },
    ];
    commitDraft(next);
    setNewLabel('');
    setNewDescription('');
  }

  function deleteNote(label: string) {
    commitDraft(draft.filter((d) => d.label !== label));
  }

  function updateNote(label: string, description: string) {
    const next = draft.map((d) =>
      d.label === label
        ? { ...d, description, updatedAt: new Date().toISOString() }
        : d,
    );
    commitDraft(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded border border-ink-800 bg-ink-900/60 p-3">
        <header className="mb-2 text-[11px] uppercase tracking-wider text-ink-400">
          새 라벨 메모 추가
        </header>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="라벨 이름"
            className="rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-100 placeholder:text-ink-600 sm:w-48"
          />
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="이 라벨이 의미하는 것을 한 줄로…"
            className="flex-1 rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-100 placeholder:text-ink-600"
          />
          <button
            type="button"
            onClick={addNote}
            disabled={!newLabel.trim()}
            className="rounded bg-claude-500 px-3 py-1 text-xs font-medium text-white hover:bg-claude-400 disabled:opacity-50"
          >
            추가
          </button>
        </div>
      </section>

      <section>
        <header className="mb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-ink-400">
            등록된 라벨 ({draft.length}개)
          </span>
          {save.isPending && <span className="text-[10px] text-ink-500">저장 중…</span>}
        </header>
        {draft.length === 0 ? (
          <div className="rounded border border-dashed border-ink-700 bg-ink-900/40 p-6 text-center text-xs text-ink-500">
            아직 등록된 라벨 메모가 없습니다.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {draft.map((note) => (
              <li
                key={note.label}
                className="rounded border border-ink-800 bg-ink-900/60 p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-claude-300">
                    {note.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteNote(note.label)}
                    className="text-[10px] text-ink-500 hover:text-rose-300"
                  >
                    삭제
                  </button>
                </div>
                <textarea
                  defaultValue={note.description}
                  onBlur={(e) => {
                    if (e.target.value !== note.description) {
                      updateNote(note.label, e.target.value);
                    }
                  }}
                  rows={2}
                  className="mt-1 w-full resize-none rounded border border-ink-800 bg-ink-900/50 p-1.5 text-xs text-ink-200 focus:border-claude-500 focus:outline-none"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {undocumented.length > 0 && (
        <section className="rounded border border-amber-500/30 bg-amber-500/5 p-3">
          <header className="mb-2 text-[11px] uppercase tracking-wider text-amber-300">
            아직 설명 없는 라벨 ({undocumented.length}개)
          </header>
          <div className="flex flex-wrap gap-1">
            {undocumented.slice(0, 30).map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={() => {
                  setNewLabel(l.label);
                  setNewDescription('');
                }}
                className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-200 hover:bg-amber-500/30"
                title={`내 이슈에서 ${l.count}회 사용됨`}
              >
                {l.label} <span className="text-amber-400/70">·{l.count}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
