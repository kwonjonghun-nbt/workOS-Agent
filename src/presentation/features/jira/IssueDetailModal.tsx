import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  jiraSnapshotQueries,
  type NormalizedIssue,
} from '../../../server-state/jira';
import { useIssueModalStore } from '../../../business/jira/issue-modal-store';

/**
 * Global Jira issue detail modal. Mount once near the app root; opened by
 * any view via `useIssueModalStore().open(key)`. Data is read from the local
 * snapshot — we don't hit Jira live yet (Phase 2 scope).
 */
export function IssueDetailModal() {
  const openedKey = useIssueModalStore((s) => s.openedKey);
  const close = useIssueModalStore((s) => s.close);
  const latest = useQuery(jiraSnapshotQueries.latest());

  useEffect(() => {
    if (!openedKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openedKey, close]);

  if (!openedKey) return null;

  const issue = latest.data?.issues.find((i) => i.key === openedKey) ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-ink-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-claude-300">{openedKey}</span>
            {issue && (
              <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-300">
                {issue.status}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded px-2 py-1 text-ink-500 hover:bg-ink-850 hover:text-ink-100"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!issue ? (
            <div className="py-12 text-center text-xs text-ink-500">
              로컬 스냅샷에서 이 이슈를 찾을 수 없습니다. (동기화 후 다시 시도하세요)
            </div>
          ) : (
            <IssueBody issue={issue} />
          )}
        </div>

        {issue && (
          <footer className="shrink-0 border-t border-ink-800 px-4 py-2 text-right">
            <a
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-claude-300 hover:underline"
            >
              Jira 에서 열기 ↗
            </a>
          </footer>
        )}
      </div>
    </div>
  );
}

function IssueBody({ issue }: { issue: NormalizedIssue }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-ink-100">{issue.summary}</h2>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Field label="타입" value={issue.issueType} />
        <Field label="우선순위" value={issue.priority ?? '—'} />
        <Field label="담당자" value={issue.assignee ?? '미할당'} />
        <Field label="보고자" value={issue.reporter ?? '—'} />
        <Field label="시작일" value={issue.startDate ?? '—'} />
        <Field label="마감일" value={issue.dueDate ?? '—'} />
        <Field
          label="스토리 포인트"
          value={issue.storyPoints == null ? '—' : String(issue.storyPoints)}
        />
        <Field label="상위 이슈" value={issue.parentKey ?? '—'} />
        <Field label="생성" value={formatDate(issue.created)} />
        <Field label="최근 갱신" value={formatDate(issue.updated)} />
      </dl>

      {issue.labels.length > 0 && (
        <section>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-ink-500">
            라벨
          </div>
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((l) => (
              <span
                key={l}
                className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-ink-200"
              >
                {l}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-ink-500">{label}</dt>
      <dd className="truncate text-ink-200">{value}</dd>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
