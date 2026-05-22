import { useEffect, useState } from 'react';
import {
  githubPrApi,
  type CreateReleaseBranchResponse,
  type CreateReleaseTagResponse,
} from '../../../api/github-pr';

type Mode = 'branch' | 'tag';

type RunState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'branch-ok'; result: CreateReleaseBranchResponse; at: number }
  | { status: 'tag-ok'; result: CreateReleaseTagResponse; at: number }
  | { status: 'error'; message: string; at: number };

export function ReleaseGenerator() {
  const [mode, setMode] = useState<Mode>('branch');
  const [repos, setRepos] = useState<string[]>([]);
  const [repo, setRepo] = useState<string>('');
  const [baseBranch, setBaseBranch] = useState('develop');
  const [targetBranch, setTargetBranch] = useState('main');
  const [tagSourceBranch, setTagSourceBranch] = useState('main');
  const [run, setRun] = useState<RunState>({ status: 'idle' });
  const [reposError, setReposError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await githubPrApi.listRepos();
        if (cancelled) return;
        setRepos(r.repos);
        if (r.repos.length > 0) setRepo(r.repos[0]);
      } catch (err) {
        if (cancelled) return;
        setReposError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    if (!repo) return;
    setRun({ status: 'pending' });
    try {
      if (mode === 'branch') {
        const result = await githubPrApi.createReleaseBranch({
          repo,
          baseBranch,
          targetBranch,
        });
        setRun({ status: 'branch-ok', result, at: Date.now() });
      } else {
        const result = await githubPrApi.createReleaseTag({ repo, branch: tagSourceBranch });
        setRun({ status: 'tag-ok', result, at: Date.now() });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRun({ status: 'error', message, at: Date.now() });
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 overflow-y-auto p-4">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wider text-ink-400">
          Release Tools
        </span>
        <p className="text-xs text-ink-400">
          앱에 설정된 GitHub 토큰으로 릴리즈 브랜치 PR을 만들거나 main 의 최신
          머지 커밋에 태그·릴리즈를 생성합니다. 로컬 체크아웃 없이 GitHub API로
          바로 수행됩니다.
        </p>
      </header>

      <div className="flex gap-1 rounded-lg bg-ink-900/60 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setMode('branch')}
          className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 transition ${
            mode === 'branch'
              ? 'bg-ink-700 text-ink-50'
              : 'text-ink-400 hover:text-ink-200'
          }`}
        >
          🚀 릴리즈 브랜치 + PR
        </button>
        <button
          type="button"
          onClick={() => setMode('tag')}
          className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 transition ${
            mode === 'tag'
              ? 'bg-ink-700 text-ink-50'
              : 'text-ink-400 hover:text-ink-200'
          }`}
        >
          🏷 태그 + GitHub Release
        </button>
      </div>

      {reposError && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-[11px] text-rose-300">
          레포 목록을 불러오지 못했습니다: {reposError}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded border border-ink-800 bg-ink-900/40 p-3">
        <label className="flex flex-col gap-1 text-xs text-ink-300">
          <span className="text-[11px] uppercase tracking-wide text-ink-400">레포</span>
          <select
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            disabled={repos.length === 0}
            className="rounded border border-ink-700 bg-ink-900 px-2 py-1 text-ink-200 disabled:opacity-50"
          >
            {repos.length === 0 && <option value="">(등록된 레포 없음)</option>}
            {repos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {mode === 'branch' ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-ink-300">
              <span className="text-[11px] uppercase tracking-wide text-ink-400">
                소스 브랜치 (head)
              </span>
              <input
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                className="rounded border border-ink-700 bg-ink-900 px-2 py-1 text-ink-200"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-300">
              <span className="text-[11px] uppercase tracking-wide text-ink-400">
                병합 대상 (base)
              </span>
              <input
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                className="rounded border border-ink-700 bg-ink-900 px-2 py-1 text-ink-200"
              />
            </label>
            <p className="text-[11px] text-ink-500">
              브랜치명은 KST 기준 <code>release/YYYYMMDD_HHmm</code> 형식으로
              자동 생성됩니다. PR 본문은 커밋 메시지 기반 템플릿으로
              채워집니다.
            </p>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs text-ink-300">
              <span className="text-[11px] uppercase tracking-wide text-ink-400">
                태그 대상 브랜치
              </span>
              <input
                value={tagSourceBranch}
                onChange={(e) => setTagSourceBranch(e.target.value)}
                className="rounded border border-ink-700 bg-ink-900 px-2 py-1 text-ink-200"
              />
            </label>
            <p className="text-[11px] text-ink-500">
              지정 브랜치의 최신 커밋에 KST <code>YYYYMMDD_HHmm</code> 태그를
              찍고, 동일한 이름으로 GitHub Release(자동 노트)도 생성합니다.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!repo || run.status === 'pending'}
          className="self-start rounded border border-claude-500/50 bg-claude-500/15 px-3 py-1.5 text-xs text-claude-200 hover:bg-claude-500/25 disabled:opacity-50"
        >
          {run.status === 'pending'
            ? '처리 중…'
            : mode === 'branch'
              ? '릴리즈 브랜치 + PR 생성'
              : '태그 + Release 생성'}
        </button>
      </div>

      {run.status === 'branch-ok' && (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-[12px] text-emerald-200">
          <div className="font-semibold">
            릴리즈 PR 생성됨 · {new Date(run.at).toLocaleTimeString()}
          </div>
          <div className="mt-1 text-emerald-300/90">브랜치: {run.result.branch}</div>
          <div className="text-emerald-300/90">커밋 수: {run.result.commitCount}</div>
          <div className="text-emerald-300/90">
            리뷰어:{' '}
            {run.result.requestedReviewers.length > 0
              ? run.result.requestedReviewers.join(', ')
              : '(지정 없음)'}
          </div>
          {run.result.reviewerWarning && (
            <div className="mt-1 text-amber-300">
              ⚠ 리뷰어 지정 실패: {run.result.reviewerWarning}
            </div>
          )}
          <a
            href={run.result.prUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block break-all text-emerald-100 underline hover:text-white"
          >
            #{run.result.prNumber} → {run.result.prUrl}
          </a>
        </div>
      )}

      {run.status === 'tag-ok' && (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-[12px] text-emerald-200">
          <div className="font-semibold">
            태그 + Release 생성됨 · {new Date(run.at).toLocaleTimeString()}
          </div>
          <div className="mt-1 text-emerald-300/90">태그: {run.result.tag}</div>
          <div className="text-emerald-300/90">대상 SHA: {run.result.sha.slice(0, 7)}</div>
          <a
            href={run.result.releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block break-all text-emerald-100 underline hover:text-white"
          >
            {run.result.releaseUrl}
          </a>
        </div>
      )}

      {run.status === 'error' && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-[11px] text-rose-300">
          <div className="font-semibold">실패 · {new Date(run.at).toLocaleTimeString()}</div>
          <div className="mt-1 break-all">{run.message}</div>
        </div>
      )}
    </div>
  );
}
