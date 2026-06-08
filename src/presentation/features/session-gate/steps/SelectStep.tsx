import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jiraQueries } from '../../../../server-state/jira';
import { useRecentTicketsStore } from '../../../../business/session-gate/recent-tickets-store';
import { Footer } from '../components/Footer';

type PickedIssue = { key: string; summary: string; url: string };

/** "기존 Jira 티켓 선택" 스텝 — 최근 티켓 + 검색/내 이슈 목록에서 고른다. */
export function SelectStep({
  submitting,
  onBack,
  onPick,
}: {
  submitting: boolean;
  onBack: () => void;
  onPick: (issue: PickedIssue) => void;
}) {
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  const myQuery = useQuery(jiraQueries.myIssues(50));
  const searchQuery = useQuery(jiraQueries.search(debounced));
  const searching = debounced.trim().length > 0;
  const active = searching ? searchQuery : myQuery;
  const issues = active.data?.issues ?? [];
  const recent = useRecentTicketsStore((s) => s.recent);

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-4">
        <input
          type="text"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="티켓 검색 (요약 또는 키, 예: PROJ-123)"
          className="w-full rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-claude-500"
        />
      </div>
      <div className="max-h-80 min-h-[8rem] overflow-y-auto px-5 py-3">
        {/* 최근 선택한 티켓 — 검색 중이 아닐 때만, 최대 3개 */}
        {!searching && recent.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-500">최근 티켓</p>
            <ul className="space-y-1">
              {recent.map((it) => (
                <li key={it.key}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => onPick({ key: it.key, summary: it.summary, url: it.url })}
                    className="w-full rounded border border-claude-500/30 bg-claude-500/5 px-3 py-2 text-left transition-colors hover:border-claude-400/60 hover:bg-claude-500/10 disabled:opacity-40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-claude-300">{it.key}</span>
                      <span className="rounded bg-claude-500/15 px-1 text-[9px] text-claude-300/90">
                        최근
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-ink-100">{it.summary}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-500">
          {searching ? '검색 결과' : '내게 할당된 이슈'}
        </p>
        {active.isLoading && <p className="text-xs text-ink-400">불러오는 중…</p>}
        {active.isError && (
          <p className="text-xs text-red-300">
            이슈를 불러오지 못했습니다. Jira 확장 설정을 확인하세요.
          </p>
        )}
        {active.data && issues.length === 0 && (
          <p className="text-xs text-ink-400">
            {searching ? '검색 결과가 없습니다.' : '할당된 이슈가 없습니다.'}
          </p>
        )}
        <ul className="space-y-1">
          {issues.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => onPick({ key: it.key, summary: it.summary, url: it.url })}
                className="w-full rounded border border-ink-800 px-3 py-2 text-left transition-colors hover:border-claude-400/60 hover:bg-claude-500/10 disabled:opacity-40"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-claude-300">{it.key}</span>
                  <span className="text-[10px] text-ink-500">{it.status}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-ink-100">{it.summary}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Footer onBack={onBack} submitting={submitting} />
    </div>
  );
}
