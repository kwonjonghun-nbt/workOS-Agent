import { JiraWorkspace } from '../jira/JiraWorkspace';
import { GitHubPrWorkspace } from '../github-pr/GitHubPrWorkspace';
import { MacroButtonsWorkspace } from '../macro-buttons/MacroButtonsWorkspace';

/**
 * Maps a `custom` view block's `component` id to a host-rendered React
 * component. Extensions can ONLY reference components registered here at
 * build time — there is no remote/eval path.
 *
 * Jira 확장은 단일 'jira-workspace' 컴포넌트로 통합되어 있다. 내부 좌측 네비에서
 * 이슈/대시보드/라벨/리포트/설정 섹션을 전환한다.
 */
export const EXTENSION_COMPONENTS: Record<string, () => JSX.Element> = {
  'jira-workspace': JiraWorkspace,
  'github-pr-workspace': GitHubPrWorkspace,
  'macro-buttons-workspace': MacroButtonsWorkspace,
};

export function resolveExtensionComponent(name: string): (() => JSX.Element) | null {
  return EXTENSION_COMPONENTS[name] ?? null;
}
