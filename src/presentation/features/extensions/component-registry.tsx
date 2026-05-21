import { JiraTaskList } from '../jira/JiraTaskList';
import { JiraTestConnection } from '../jira/JiraTestConnection';

/**
 * Maps a `custom` view block's `component` id to a host-rendered React
 * component. Extensions can ONLY reference components registered here at
 * build time — there is no remote/eval path.
 */
export const EXTENSION_COMPONENTS: Record<string, () => JSX.Element> = {
  'jira-task-list': JiraTaskList,
  'jira-test-connection': JiraTestConnection,
};

export function resolveExtensionComponent(name: string): (() => JSX.Element) | null {
  return EXTENSION_COMPONENTS[name] ?? null;
}
