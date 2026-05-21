/**
 * Deterministic per-repo color so the same repo always renders with the same
 * chip/accent across cards and group headers.
 */
function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export type RepoChipStyle = {
  accent: string;
  fg: string;
  bg: string;
  border: string;
};

export function repoChipStyle(repo: string): RepoChipStyle {
  const hue = hash(repo) % 360;
  return {
    accent: `hsl(${hue} 70% 55%)`,
    fg: `hsl(${hue} 80% 80%)`,
    bg: `hsl(${hue} 60% 18% / 0.55)`,
    border: `hsl(${hue} 60% 45% / 0.5)`,
  };
}
