import type { NormalizedIssue } from './jira-issue';

/**
 * Build a Slack-mrkdwn structured daily report for a single assignee.
 *
 * Layout:
 *   *{assignee}*
 *
 *   *{Component}*
 *     {EpicLink} {EpicSummary}
 *       • {TaskLink} {TaskSummary} ({status})
 *     • {StandaloneTaskLink} {Summary} ({status})
 *
 *   *{기타}*
 *     ...
 *
 * Rules:
 *  - only `statusCategory === 'indeterminate'` (진행중) tasks are included
 *  - Epic tickets are climbed via `parentKey` chain (with cycle guard)
 *  - tasks without an Epic are listed as standalone bullets
 *  - tasks/epics with no component go under "기타" (sorted last)
 *  - returns '' when the assignee has no in-progress task — caller can skip
 */
export function buildSlackStructuredReport(
  assignee: string,
  allIssues: ReadonlyArray<NormalizedIssue>,
  baseUrl: string,
): string {
  const issueMap = new Map<string, NormalizedIssue>();
  for (const issue of allIssues) issueMap.set(issue.key, issue);

  const isEpic = (i: NormalizedIssue) =>
    i.issueType === 'Epic' || i.issueType === '에픽';

  const inProgressTasks = allIssues.filter(
    (i) =>
      i.assignee === assignee &&
      i.statusCategory === 'indeterminate' &&
      !isEpic(i),
  );
  if (inProgressTasks.length === 0) return '';

  const findEpic = (issue: NormalizedIssue): NormalizedIssue | null => {
    let current = issue;
    const visited = new Set<string>();
    while (current.parentKey) {
      if (visited.has(current.parentKey)) break;
      visited.add(current.parentKey);
      const parent = issueMap.get(current.parentKey);
      if (!parent) break;
      if (isEpic(parent)) return parent;
      current = parent;
    }
    return null;
  };

  type EpicGroup = { epic: NormalizedIssue; tasks: NormalizedIssue[] };
  const epicTaskMap = new Map<string, NormalizedIssue[]>();
  const orphanTasks: NormalizedIssue[] = [];

  for (const task of inProgressTasks) {
    const epic = findEpic(task);
    if (epic) {
      const list = epicTaskMap.get(epic.key) ?? [];
      list.push(task);
      epicTaskMap.set(epic.key, list);
    } else {
      orphanTasks.push(task);
    }
  }

  const componentMap = new Map<string, EpicGroup[]>();
  const jiraUrl = baseUrl.replace(/\/$/, '');

  const addGroup = (componentName: string, group: EpicGroup) => {
    const list = componentMap.get(componentName) ?? [];
    const existing = list.find((g) => g.epic.key === group.epic.key);
    if (existing) existing.tasks.push(...group.tasks);
    else list.push(group);
    componentMap.set(componentName, list);
  };

  for (const [epicKey, tasks] of epicTaskMap) {
    const epic = issueMap.get(epicKey);
    if (!epic) continue;
    const comps = Array.isArray(epic.components) && epic.components.length > 0 ? epic.components : ['기타'];
    for (const c of comps) addGroup(c, { epic, tasks: [...tasks] });
  }

  for (const task of orphanTasks) {
    const comps = Array.isArray(task.components) && task.components.length > 0 ? task.components : ['기타'];
    for (const c of comps) {
      const list = componentMap.get(c) ?? [];
      list.push({ epic: task, tasks: [] });
      componentMap.set(c, list);
    }
  }

  const makeLink = (key: string) => `<${jiraUrl}/browse/${key}|${key}>`;

  const sortedComponents = [...componentMap.keys()].sort((a, b) => {
    if (a === '기타') return 1;
    if (b === '기타') return -1;
    return a.localeCompare(b);
  });

  const lines: string[] = [`*${assignee}*`, ''];
  for (const comp of sortedComponents) {
    const groups = componentMap.get(comp);
    if (!groups) continue;
    lines.push(`*${comp}*`);
    for (const { epic, tasks } of groups) {
      if (tasks.length > 0) {
        lines.push(`  ${makeLink(epic.key)} ${epic.summary}`);
        for (const task of tasks) {
          lines.push(
            `    • ${makeLink(task.key)} ${task.summary} (${task.status})`,
          );
        }
      } else {
        lines.push(`  • ${makeLink(epic.key)} ${epic.summary} (${epic.status})`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

/** Distinct, non-null assignees across the provided issues, in stable order. */
export function extractAssignees(
  issues: ReadonlyArray<NormalizedIssue>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of issues) {
    if (i.assignee && !seen.has(i.assignee)) {
      seen.add(i.assignee);
      out.push(i.assignee);
    }
  }
  return out;
}
