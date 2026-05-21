import type { GitHubPullRequest } from '../../../server-state/github-pr';
import { repoChipStyle } from './repo-color';

function getStatusBadge(pr: GitHubPullRequest) {
  if (pr.draft) return { label: 'Draft', tone: 'bg-ink-700 text-ink-200' };
  if (pr.merged) return { label: 'Merged', tone: 'bg-purple-600/80 text-white' };
  if (pr.state === 'open') return { label: 'Open', tone: 'bg-emerald-600/80 text-white' };
  return { label: 'Closed', tone: 'bg-rose-600/80 text-white' };
}

export function PRCard({
  pr,
  showRepo = true,
}: {
  pr: GitHubPullRequest;
  showRepo?: boolean;
}) {
  const badge = getStatusBadge(pr);
  const relative = formatRelative(pr.createdAt);
  const repoStyle = repoChipStyle(pr.repo);

  return (
    <a
      href={pr.htmlUrl}
      target="_blank"
      rel="noreferrer"
      className="relative block rounded-lg border border-ink-800 bg-ink-900/60 p-3 pl-4 transition hover:border-ink-700 hover:bg-ink-850"
      style={{ borderLeft: `3px solid ${repoStyle.accent}` }}
    >
      <div className="flex items-start gap-3">
        <img
          src={pr.user.avatarUrl}
          alt={pr.user.login}
          className="mt-0.5 h-8 w-8 shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.tone}`}>
              {badge.label}
            </span>
            {showRepo && (
              <span
                className="inline-flex items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  color: repoStyle.fg,
                  backgroundColor: repoStyle.bg,
                  borderColor: repoStyle.border,
                }}
                title={pr.repo}
              >
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: repoStyle.accent }}
                />
                {pr.repo}
              </span>
            )}
          </div>

          <h3 className="mb-1.5 text-sm leading-snug text-ink-100">
            <span className="mr-1 text-ink-500">#{pr.number}</span>
            {pr.title}
          </h3>

          <div className="flex items-center gap-3 text-[11px] text-ink-500">
            <span>{pr.user.login}</span>
            <span className="truncate text-ink-600" title={pr.headRef}>
              {pr.headRef}
            </span>
            <span>{relative}</span>
          </div>

          {(pr.labels.length > 0 || pr.requestedReviewers.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {pr.labels.map((label) => (
                <span
                  key={label.name}
                  className="rounded-full border px-1.5 py-0.5 text-[10px]"
                  style={{ color: `#${label.color}`, borderColor: `#${label.color}40` }}
                >
                  {label.name}
                </span>
              ))}
              {pr.requestedReviewers.length > 0 && (
                <span className="rounded-full border border-amber-700/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                  리뷰 요청: {pr.requestedReviewers.map((r) => r.login).join(', ')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </a>
  );
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
