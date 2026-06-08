/**
 * Jira 티켓으로부터 feature 브랜치 이름을 만드는 순수 도메인 규칙.
 *
 * 순수 TS only — electron/fs/git 의존 금지. 입출력은 문자열뿐이라 테스트가 쉽다.
 */

/**
 * 임의 텍스트(영문 요약 후보)를 git 브랜치에 안전한 영문 slug 로 정규화한다.
 * 소문자화 → 공백 런을 `_` 로 → `[a-z0-9_]` 외 제거 → `_` 연속 축약 → 양끝 `_` 제거 → 길이 제한.
 * 결과가 비면 빈 문자열을 돌려준다(상위에서 null 처리).
 */
export function slugifyEnglish(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
    .replace(/_+$/g, '');
}

/**
 * `feature/{ticketKey}_{slug}` (slug 있으면) 또는 `feature/{ticketKey}` (없으면).
 * ticketKey 의 `-`(예: PROJ-123)는 git 브랜치명에서 유효하다.
 */
export function buildFeatureBranchName(ticketKey: string, slug: string | null): string {
  const key = ticketKey.trim();
  return slug ? `feature/${key}_${slug}` : `feature/${key}`;
}

/**
 * 브랜치를 만들지 않을 이슈 타입인지 판별. Epic/Bug 는 건너뛴다.
 * 이름이 현지화될 수 있으므로(한국어 "버그"/"에픽") 이름 정규식으로 본다.
 * Epic 은 생성 폼에서 이미 선택 불가이지만 방어적으로 포함한다.
 */
export function branchSkipReason(issueTypeName: string): 'bug' | 'epic' | null {
  const name = issueTypeName.trim();
  if (/bug|버그/i.test(name)) return 'bug';
  if (/epic|에픽/i.test(name)) return 'epic';
  return null;
}
