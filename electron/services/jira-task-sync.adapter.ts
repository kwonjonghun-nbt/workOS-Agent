// JiraService 를 TaskSyncPort 로 어댑팅한다.
// WorkOSService 는 이 포트만 알면 되므로 JiraService 와의 직접 결합이 끊긴다.

import type { TaskSyncIssue, TaskSyncPort } from '../domain/task-sync-port';
import type { JiraService } from './jira.service';

export class JiraTaskSyncAdapter implements TaskSyncPort {
  constructor(private readonly jira: JiraService) {}

  async getParent(parentKey: string): Promise<TaskSyncIssue> {
    const detail = await this.jira.getIssueDetail(parentKey);
    // GetIssueDetailResponse 에는 status 가 없으므로 빈 문자열로 채운다.
    // workOS 측은 부모의 status 를 사용하지 않으므로 안전.
    return {
      key: detail.key,
      summary: detail.summary,
      issueType: detail.issueType,
      status: '',
    };
  }

  async listChildren(parentKey: string): Promise<TaskSyncIssue[]> {
    const { children } = await this.jira.listIssueChildren(parentKey);
    return children.map((c) => ({
      key: c.key,
      summary: c.summary,
      issueType: c.issueType,
      status: c.status,
    }));
  }

  async transitionItem(
    issueKey: string,
    taskItemStatus: string,
  ): Promise<{ toStatus: string } | null> {
    // 이슈 키에서 프로젝트 키 추출(PROJ-123 → PROJ) — 매핑 override 우선 lookup.
    const projectKey = issueKey.includes('-') ? issueKey.split('-')[0] : undefined;
    const map = await this.jira.getStatusTransitionMap(projectKey);
    const mapping = map[taskItemStatus];
    if (!mapping) return null;
    // id 우선, 없으면 name fallback (legacy 호환).
    const result = await this.jira.transitionIssue(issueKey, {
      transitionId: mapping.id || undefined,
      transitionName: mapping.name || undefined,
    });
    return { toStatus: result.toStatus };
  }

  async isAvailable(): Promise<boolean> {
    // JiraService 자체가 호출 시점에 extension enabled 검증을 수행하므로,
    // 어댑터 레벨에서는 단순히 true 를 반환한다. 호출 실패는 throw 로 surface.
    return true;
  }

  async getReverseStatusMap(projectKey?: string): Promise<Record<string, string>> {
    const map = await this.jira.getStatusTransitionMap(projectKey);
    const reverse: Record<string, string> = {};
    for (const [taskItemStatus, mapping] of Object.entries(map)) {
      const to = (mapping.toStatus ?? '').trim();
      if (to) reverse[to] = taskItemStatus;
    }
    return reverse;
  }
}
