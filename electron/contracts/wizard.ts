import { z } from 'zod';
import { idSchema } from './workOS';

// 자비스 위저드 — 워크스페이스당 1개의 대화 세션.
// 메시지 히스토리 + 진행 상태를 보관해, 사용자가 탭을 떠도 흐름이 유지된다.

export const wizardMessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type WizardMessageRole = z.infer<typeof wizardMessageRoleSchema>;

/** 메시지에 첨부되는 인라인 액션 칩 (assistant 메시지에만 의미가 있다). */
export const wizardActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('approve-proposal') }),
  z.object({ kind: z.literal('reject-proposal') }),
  z.object({ kind: z.literal('proceed-next') }),
  z.object({ kind: z.literal('show-progress') }),
  z.object({ kind: z.literal('reset') }),
  z.object({ kind: z.literal('open-task'), taskId: idSchema }),
]);
export type WizardAction = z.infer<typeof wizardActionSchema>;

export const wizardMessageSchema = z.object({
  id: z.string().min(1),
  role: wizardMessageRoleSchema,
  text: z.string(),
  at: z.number().int(),
  actions: z.array(wizardActionSchema).optional(),
  /** 자유 형태 메타데이터 (proposal payload 등). 직렬화 가능한 값만. */
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type WizardMessage = z.infer<typeof wizardMessageSchema>;

/**
 * idle      — 시작 직후. 사용자 입력 대기.
 * gathering — 자유텍스트 입력 받는 중 (intent 파싱 직전).
 * proposing — workflow 추천 + Task 생성 제안을 띄우고 사용자 승인 대기.
 * executing — TaskItem 실행 중 (currentItemId 있음).
 * reviewing — 한 TaskItem 완료 직후 사용자 검토 + "다음 진행" 대기.
 * done      — 모든 TaskItem 완료.
 */
export const wizardPhaseSchema = z.enum([
  'idle',
  'gathering',
  'proposing',
  'executing',
  'reviewing',
  'done',
]);
export type WizardPhase = z.infer<typeof wizardPhaseSchema>;

/** assistant 가 제안한 (아직 승인 전) 워크플로 + Task 후보. */
export const wizardProposalSchema = z.object({
  workflowId: idSchema,
  workflowName: z.string(),
  title: z.string(),
  requirement: z.string(),
  reasoning: z.string().optional(),
});
export type WizardProposal = z.infer<typeof wizardProposalSchema>;

export const wizardSessionSchema = z.object({
  workspaceId: z.string().min(1),
  phase: wizardPhaseSchema,
  messages: z.array(wizardMessageSchema),
  currentTaskId: idSchema.optional(),
  currentItemId: idSchema.optional(),
  pendingProposal: wizardProposalSchema.optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type WizardSession = z.infer<typeof wizardSessionSchema>;

// --- IPC requests ---------------------------------------------------------

const workspaceIdReq = z.object({ workspaceId: z.string().min(1) });

export const wizardGetRequestSchema = workspaceIdReq;
export type WizardGetRequest = z.infer<typeof wizardGetRequestSchema>;

export const wizardSendMessageRequestSchema = workspaceIdReq.extend({
  text: z.string().min(1),
});
export type WizardSendMessageRequest = z.infer<typeof wizardSendMessageRequestSchema>;

export const wizardApproveProposalRequestSchema = workspaceIdReq;
export type WizardApproveProposalRequest = z.infer<typeof wizardApproveProposalRequestSchema>;

export const wizardRejectProposalRequestSchema = workspaceIdReq;
export type WizardRejectProposalRequest = z.infer<typeof wizardRejectProposalRequestSchema>;

export const wizardProceedNextRequestSchema = workspaceIdReq;
export type WizardProceedNextRequest = z.infer<typeof wizardProceedNextRequestSchema>;

export const wizardResetRequestSchema = workspaceIdReq;
export type WizardResetRequest = z.infer<typeof wizardResetRequestSchema>;

export type WizardUpdatedEvent = { workspaceId: string };
