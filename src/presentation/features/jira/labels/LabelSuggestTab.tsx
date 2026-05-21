import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  jiraLabelMutations,
  jiraLabelQueries,
  jiraSnapshotKeys,
  jiraSnapshotQueries,
  type NormalizedIssue,
  type SuggestLabelResponse,
} from '../../../../server-state/jira';
import { useIssueModalStore } from '../../../../business/jira/issue-modal-store';

type Suggestion = SuggestLabelResponse & { applied?: boolean };

/**
 * 내 지라 목록의 라벨이 비어있는 이슈에 대해 LabelNotes 목록을 후보로 LLM 추천 → 적용 흐름.
 * client-jira 와 달리 "사람 선택" UI 가 없다 — 항상 currentUser 의 이슈만 대상으로 한다.
 */
export function LabelSuggestTab() {
  const queryClient = useQueryClient();
  const latestQuery = useQuery(jiraSnapshotQueries.latest());
  const notesQuery = useQuery(jiraLabelQueries.notes());
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const openIssue = useIssueModalStore((s) => s.open);

  const suggest = useMutation(jiraLabelMutations.suggest());
  const updateLabels = useMutation(jiraLabelMutations.updateIssueLabels());

  const candidates = useMemo(
    () =>
      (notesQuery.data ?? []).map((n) => ({
        label: n.label,
        description: n.description || undefined,
      })),
    [notesQuery.data],
  );

  const unlabeled = useMemo(() => {
    const issues = latestQuery.data?.issues ?? [];
    return issues
      .filter((i) => i.labels.length === 0 && i.statusCategory !== 'done')
      .slice(0, 30);
  }, [latestQuery.data]);

  async function runSuggest(issue: NormalizedIssue) {
    if (candidates.length === 0) return;
    setBusyKey(issue.key);
    try {
      const res = await suggest.mutateAsync({
        issueKey: issue.key,
        summary: issue.summary,
        description: '',
        candidates,
      });
      setSuggestions((prev) => ({ ...prev, [issue.key]: res }));
    } catch (err) {
      setSuggestions((prev) => ({
        ...prev,
        [issue.key]: {
          labels: [],
          reason: `오류: ${err instanceof Error ? err.message : String(err)}`,
        },
      }));
    } finally {
      setBusyKey(null);
    }
  }

  async function applySuggestion(issue: NormalizedIssue) {
    const s = suggestions[issue.key];
    if (!s || s.labels.length === 0) return;
    setBusyKey(issue.key);
    try {
      await updateLabels.mutateAsync({
        issueKey: issue.key,
        labels: [...issue.labels, ...s.labels],
      });
      setSuggestions((prev) => ({
        ...prev,
        [issue.key]: { ...s, applied: true },
      }));
      void queryClient.invalidateQueries({ queryKey: jiraSnapshotKeys.all });
    } finally {
      setBusyKey(null);
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded border border-dashed border-ink-700 bg-ink-900/40 p-8 text-center text-xs text-ink-500">
        먼저 「라벨 관리」 탭에서 후보 라벨을 등록하세요. LLM은 등록된 라벨 중에서만 추천합니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded border border-ink-800 bg-ink-900/40 p-2 text-[11px] text-ink-400">
        대상: <b className="text-ink-200">내 이슈</b> 중 라벨이 비어있고 완료되지 않은 이슈만
        ({unlabeled.length}건 표시) · 후보 {candidates.length}개 · LLM: <code>claude</code> CLI
      </div>

      {unlabeled.length === 0 ? (
        <div className="rounded border border-dashed border-ink-700 bg-ink-900/40 p-8 text-center text-xs text-ink-500">
          라벨이 비어있는 이슈가 없습니다.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {unlabeled.map((issue) => {
            const s = suggestions[issue.key];
            const isBusy = busyKey === issue.key;
            return (
              <li
                key={issue.key}
                className="rounded border border-ink-800 bg-ink-900/60 p-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openIssue(issue.key)}
                    className="font-mono text-[11px] text-claude-300 hover:underline"
                  >
                    {issue.key}
                  </button>
                  <span className="truncate text-ink-100">{issue.summary}</span>
                  <button
                    type="button"
                    onClick={() => runSuggest(issue)}
                    disabled={isBusy}
                    className="ml-auto rounded border border-ink-700 px-2 py-0.5 text-[10px] text-ink-200 hover:bg-ink-850 disabled:opacity-50"
                  >
                    {isBusy && !s ? '분석 중…' : '🤖 추천'}
                  </button>
                </div>
                {s && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {s.labels.length > 0 ? (
                      s.labels.map((l) => (
                        <span
                          key={l}
                          className="rounded bg-claude-500/20 px-1.5 py-0.5 text-[11px] text-claude-200"
                        >
                          {l}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-amber-300">추천 라벨 없음</span>
                    )}
                    <span className="flex-1 text-[10px] text-ink-400">{s.reason}</span>
                    {s.labels.length > 0 && !s.applied && (
                      <button
                        type="button"
                        onClick={() => applySuggestion(issue)}
                        disabled={isBusy}
                        className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        {isBusy ? '적용 중…' : '✓ 적용'}
                      </button>
                    )}
                    {s.applied && (
                      <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-100">
                        적용됨
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
