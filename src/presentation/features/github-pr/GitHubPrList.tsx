import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  githubPrKeys,
  githubPrQueries,
  type PrStateFilter,
} from '../../../server-state/github-pr';
import { PRCard } from './PRCard';

const STATE_TABS: { value: PrStateFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

export function GitHubPrList() {
  const [stateFilter, setStateFilter] = useState<PrStateFilter>('open');
  const [repoFilter, setRepoFilter] = useState<string>('');
  const queryClient = useQueryClient();
  const query = useQuery(githubPrQueries.pullRequests(stateFilter));

  const repos = useMemo(() => {
    if (!query.data?.prs) return [];
    return Array.from(new Set(query.data.prs.map((pr) => pr.repo))).sort();
  }, [query.data?.prs]);

  const filteredPRs = useMemo(() => {
    const prs = query.data?.prs ?? [];
    if (!repoFilter) return prs;
    return prs.filter((pr) => pr.repo === repoFilter);
  }, [query.data?.prs, repoFilter]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: githubPrKeys.all });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wider text-ink-400">
            GitHub Pull Requests
          </span>
          {query.dataUpdatedAt > 0 && (
            <span className="text-[10px] text-ink-500">
              마지막 갱신 · {new Date(query.dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={query.isFetching}
          className="rounded border border-ink-700 px-2 py-0.5 text-[11px] text-ink-300 hover:bg-ink-850 disabled:opacity-50"
        >
          {query.isFetching ? '갱신 중…' : '↻ 새로고침'}
        </button>
      </header>

      <div className="flex items-center gap-3 border-b border-ink-800 px-4 py-2">
        <div className="flex gap-1 rounded-lg bg-ink-900/60 p-0.5">
          {STATE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStateFilter(tab.value)}
              className={`cursor-pointer rounded-md px-3 py-1 text-xs transition ${
                stateFilter === tab.value
                  ? 'bg-ink-700 text-ink-50'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              {tab.label}
              {tab.value === stateFilter && query.data?.prs && (
                <span className="ml-1 text-ink-500">({filteredPRs.length})</span>
              )}
            </button>
          ))}
        </div>

        {repos.length > 1 && (
          <select
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            className="rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-200"
          >
            <option value="">모든 레포</option>
            {repos.map((repo) => (
              <option key={repo} value={repo}>
                {repo}
              </option>
            ))}
          </select>
        )}
      </div>

      {query.data?.errors && query.data.errors.length > 0 && (
        <div className="mx-4 mt-3 rounded border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          일부 레포 조회 실패: {query.data.errors.map((e) => e.repo).join(', ')}
        </div>
      )}
      {query.data?.hasMore && (
        <div className="mx-4 mt-3 rounded border border-sky-700/40 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-300">
          레포당 최신 100개만 표시됩니다.
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {query.isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-ink-900/60" />
            ))}
          </div>
        )}

        {query.isError && (
          <div className="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-[11px] text-rose-300">
            <div className="font-semibold">PR을 불러오지 못했습니다.</div>
            <div className="mt-1 break-all">
              {(query.error as Error)?.message ?? '알 수 없는 오류'}
            </div>
            <div className="mt-1 text-rose-300/80">
              설정 페이지에서 토큰과 레포 목록을 점검하세요.
            </div>
          </div>
        )}

        {!query.isLoading && !query.isError && filteredPRs.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs text-ink-500">
            {repoFilter ? '선택한 레포에 PR이 없습니다.' : '등록된 레포에 PR이 없습니다.'}
          </div>
        )}

        {!query.isLoading && filteredPRs.length > 0 && (
          <ul className="flex flex-col gap-2">
            {filteredPRs.map((pr) => (
              <li key={`${pr.repo}-${pr.number}`}>
                <PRCard pr={pr} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
