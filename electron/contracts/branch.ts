import { z } from 'zod';

/**
 * 세션 게이트에서 새 Jira 티켓을 만든 직후, 그 티켓을 위한 feature 브랜치를
 * `origin/develop` 기준으로 생성·체크아웃하는 요청.
 *
 * Renderer-only 영역에서는 동일 타입을 type-only 로 미러링한다(런타임 공유 금지).
 */
export const createTicketBranchRequestSchema = z.object({
  /** 브랜치를 만들 워크스페이스(= git 저장소 cwd anchor). */
  workspaceId: z.string().min(1),
  /** 티켓 키. 브랜치명의 `feature/{ticketKey}` 부분이 된다. */
  ticketKey: z.string().min(1),
  /** 티켓 요약(보통 한글). 영문 slug 로 번역 시도 후 브랜치명에 붙는다. */
  summary: z.string().default(''),
  /** 이슈 타입 이름. Epic/Bug 면 브랜치 생성을 건너뛴다. */
  issueTypeName: z.string().default(''),
  /** 분기 기준. 기본 origin/develop. */
  baseBranch: z.string().default('origin/develop'),
});
export type CreateTicketBranchRequest = z.infer<typeof createTicketBranchRequestSchema>;

export type CreateTicketBranchResponse = {
  /** 실제로 브랜치를 만들었는지(Epic/Bug 는 false). */
  created: boolean;
  /** 만든(또는 만들었을) 브랜치명. 건너뛴 경우 null. */
  branchName: string | null;
  /** 건너뛴 이유(Epic/Bug). 생성된 경우 null. */
  skippedReason: 'bug' | 'epic' | null;
};
