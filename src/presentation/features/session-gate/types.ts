import type { JiraIssueType } from '../../../server-state/jira';

/** 에픽(또는 일반 티켓 선택)의 최소 식별 정보. */
export type Epic = { key: string; summary: string };

/** CreateStep 이 제출 시 부모로 넘기는 페이로드(에픽은 parentKey 로 합쳐짐). */
export type CreateSubmit = {
  projectKey: string;
  issueTypeId: string;
  /** 선택된 이슈 타입의 이름. 브랜치 생성 시 Epic/Bug 판별에 쓰인다(Jira 생성 요청엔 포함되지 않음). */
  issueTypeName: string;
  summary: string;
  descriptionMarkdown?: string;
  parentKey: string;
};

/**
 * Epic 이슈 타입 판별. 이름이 현지화될 수 있으므로(한국어 "에픽")
 * hierarchyLevel === 1 을 우선 사용하고, 그 정보가 없으면 이름으로 폴백한다.
 */
export function isEpicType(t: Pick<JiraIssueType, 'name' | 'hierarchyLevel'>): boolean {
  return t.hierarchyLevel === 1 || (t.hierarchyLevel == null && /epic|에픽/i.test(t.name));
}
