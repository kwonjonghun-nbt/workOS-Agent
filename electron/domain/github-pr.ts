import type { GitHubPullRequest } from '../contracts/github-pr';

export type GitHubPrConfig = {
  token: string;
  apiUrl: string;
  repos: Array<{ owner: string; repo: string; full: string }>;
};

/**
 * Parse "owner/repo, owner2/repo2" into structured entries. Ignores blanks and
 * malformed segments (does not throw — the service layer reports the count
 * upstream so the user knows whether parsing dropped anything).
 */
export function parseRepos(raw: string): Array<{ owner: string; repo: string; full: string }> {
  const parsed = raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const m = entry.match(/^([\w.-]+)\/([\w.-]+)$/);
      if (!m) return null;
      return { owner: m[1], repo: m[2], full: `${m[1]}/${m[2]}` };
    })
    .filter((v): v is { owner: string; repo: string; full: string } => v !== null);
  // GitHub repo names are case-insensitive, so fold duplicates that only
  // differ in casing (e.g. "Vercel/Next.js" vs "vercel/next.js") and exact
  // repeats from the user pasting the same entry twice.
  const seen = new Set<string>();
  const out: Array<{ owner: string; repo: string; full: string }> = [];
  for (const entry of parsed) {
    const key = entry.full.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

export function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed || 'https://api.github.com';
}

// Raw shape returned by GitHub's `GET /repos/:owner/:repo/pulls`.
export type GithubListPullsItem = {
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft: boolean;
  merged_at: string | null;
  user: { login: string; avatar_url: string };
  head: { ref: string };
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: Array<{ name: string; color: string }>;
  requested_reviewers: Array<{ login: string }>;
};

export function mapPullRequest(
  raw: GithubListPullsItem,
  repoFullName: string,
): GitHubPullRequest {
  return {
    number: raw.number,
    title: raw.title,
    state: raw.state,
    draft: raw.draft,
    merged: raw.merged_at !== null,
    user: { login: raw.user.login, avatarUrl: raw.user.avatar_url },
    repo: repoFullName,
    headRef: raw.head.ref,
    htmlUrl: raw.html_url,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    labels: raw.labels.map((l) => ({ name: l.name, color: l.color })),
    requestedReviewers: raw.requested_reviewers.map((r) => ({ login: r.login })),
  };
}
