import { useMemo } from 'react';
import type { GitHubPullRequest } from '../../../server-state/github-pr';
import { repoChipStyle } from './repo-color';

type Props = { prs: GitHubPullRequest[] };

/**
 * Repo 그룹 → 그 안에서 작성 시점 버킷(오늘/이번 주/이번 달/더 오래됨)으로
 * 묶어 시계열 흐름을 보여준다. 카드 자체는 매거진 스타일.
 */
export function PRListTimeline({ prs }: Props) {
  const groups = useMemo(() => groupByRepoThenBucket(prs), [prs]);

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ repo, buckets, total }) => {
        const style = repoChipStyle(repo);
        return (
          <section key={repo} className="flex flex-col gap-3">
            <header className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: style.accent }}
              />
              <span
                className="text-[12px] font-semibold tracking-wide"
                style={{ color: style.fg }}
              >
                {repo}
              </span>
              <span className="text-[10px] text-ink-500">{total}</span>
              <div className="ml-2 h-px flex-1 bg-ink-800" />
            </header>

            <div className="flex flex-col gap-4 pl-1">
              {buckets.map((bucket) => (
                <div key={bucket.key} className="flex gap-3">
                  <div className="flex w-14 shrink-0 flex-col items-end pt-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-300">
                      {bucket.label}
                    </div>
                    <div className="text-[10px] text-ink-500">
                      {bucket.items.length}건
                    </div>
                  </div>
                  <div className="relative min-w-0 flex-1 border-l border-ink-800 pl-4">
                    <ul className="flex flex-col gap-2">
                      {bucket.items.map((pr) => (
                        <li key={`${pr.repo}-${pr.number}`} className="relative">
                          <span
                            aria-hidden
                            className="absolute -left-[1.125rem] top-4 h-2 w-2 rounded-full ring-2 ring-ink-900"
                            style={{ backgroundColor: style.accent }}
                          />
                          <PRMagazineCard pr={pr} accent={style.accent} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PRMagazineCard({
  pr,
  accent,
}: {
  pr: GitHubPullRequest;
  accent: string;
}) {
  const status = getStatusMeta(pr);
  return (
    <a
      href={pr.htmlUrl}
      target="_blank"
      rel="noreferrer"
      className="group relative block overflow-hidden rounded-lg border border-ink-800 bg-ink-900/60 transition hover:border-ink-700 hover:bg-ink-850"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start gap-3 p-3 pl-4">
        <img
          src={pr.user.avatarUrl}
          alt={pr.user.login}
          className="h-9 w-9 shrink-0 rounded-full ring-2 ring-ink-800"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${status.tone}`}
            >
              {status.label}
            </span>
            <span className="text-[10px] text-ink-500">
              #{pr.number} · {pr.user.login}
            </span>
            <span className="ml-auto text-[10px] tabular-nums text-ink-500">
              {formatRelative(pr.createdAt)}
            </span>
          </div>
          <h3 className="text-sm leading-snug text-ink-100 group-hover:text-white">
            {pr.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <code
              className="rounded bg-ink-950/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-400"
              title={pr.headRef}
            >
              {pr.headRef}
            </code>
            {pr.labels.map((l) => (
              <span
                key={l.name}
                className="rounded-full border px-1.5 py-0.5 text-[10px]"
                style={{
                  color: `#${l.color}`,
                  borderColor: `#${l.color}55`,
                  backgroundColor: `#${l.color}1a`,
                }}
              >
                {l.name}
              </span>
            ))}
            {pr.requestedReviewers.length > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                🔔 리뷰: {pr.requestedReviewers.map((r) => r.login).join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

/* ── helpers ────────────────────────────────────────────────── */

type Bucket = { key: string; label: string; items: GitHubPullRequest[] };
type RepoGroup = { repo: string; buckets: Bucket[]; total: number };

function groupByRepoThenBucket(prs: GitHubPullRequest[]): RepoGroup[] {
  const byRepo = new Map<string, GitHubPullRequest[]>();
  for (const pr of prs) {
    const list = byRepo.get(pr.repo) ?? [];
    list.push(pr);
    byRepo.set(pr.repo, list);
  }
  const now = Date.now();
  return Array.from(byRepo.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([repo, items]) => {
      const buckets: Bucket[] = [
        { key: 'today', label: '오늘', items: [] },
        { key: 'week', label: '이번 주', items: [] },
        { key: 'month', label: '이번 달', items: [] },
        { key: 'older', label: '더 오래됨', items: [] },
      ];
      const sorted = [...items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      for (const pr of sorted) {
        const ageDays = (now - new Date(pr.createdAt).getTime()) / 86_400_000;
        if (ageDays < 1) buckets[0].items.push(pr);
        else if (ageDays < 7) buckets[1].items.push(pr);
        else if (ageDays < 30) buckets[2].items.push(pr);
        else buckets[3].items.push(pr);
      }
      return {
        repo,
        total: items.length,
        buckets: buckets.filter((b) => b.items.length > 0),
      };
    });
}

function getStatusMeta(pr: GitHubPullRequest) {
  if (pr.draft) return { label: 'Draft', tone: 'bg-ink-700 text-ink-200' };
  if (pr.merged) return { label: 'Merged', tone: 'bg-purple-600/80 text-white' };
  if (pr.state === 'open') return { label: 'Open', tone: 'bg-emerald-600/80 text-white' };
  return { label: 'Closed', tone: 'bg-rose-600/80 text-white' };
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString();
}
