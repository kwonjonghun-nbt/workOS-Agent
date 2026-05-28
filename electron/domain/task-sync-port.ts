// 외부 작업 추적 시스템(Jira 등)과 TaskItem 을 동기화하기 위한 도메인 포트.
// 순수 TypeScript — electron/fs/http 클라이언트 import 금지.

export type TaskSyncIssue = {
  key: string;
  summary: string;
  issueType: string;
  status: string;
};

export interface TaskSyncPort {
  /** 외부 시스템(예: Jira)에서 부모 티켓 정보 조회. */
  getParent(parentKey: string): Promise<TaskSyncIssue>;

  /** 자식 티켓 리스트 — 호출자가 필요 시 명시 키로 필터링. */
  listChildren(parentKey: string): Promise<TaskSyncIssue[]>;

  /**
   * TaskItem status 를 외부 시스템 status 로 전환 (jira transition 등).
   * 매핑되는 transition 이 없으면 null 반환(noop, 에러 아님).
   * 실제 외부 호출 실패 시에는 throw.
   */
  transitionItem(
    issueKey: string,
    taskItemStatus: string,
  ): Promise<{ toStatus: string } | null>;

  /** 외부 시스템이 활성/설정 완료 상태인지. */
  isAvailable(): Promise<boolean>;

  /**
   * 외부 status name → TaskItem status 역방향 매핑. 사용자가 설정한
   * statusTransitions(toStatus) 정보가 있으면 그 inverse, 없으면 빈 객체.
   * projectKey 가 주어지면 project-specific override 를 우선 사용.
   */
  getReverseStatusMap(projectKey?: string): Promise<Record<string, string>>;
}
