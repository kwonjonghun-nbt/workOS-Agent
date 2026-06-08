import { z } from 'zod';

/**
 * Session-Start Jira Gate contract.
 *
 * Flow: claude 세션이 시작될 때 SessionStart 훅이 control plane 의
 * {@link SESSION_GATE_ROUTE} 로 long-poll POST → main 이 렌더러에 모달을 띄우는
 * {@link SessionGateOpenEvent} 를 브로드캐스트 → 사용자가 생성/선택/스킵하면
 * 렌더러가 {@link sessionGateResolveRequestSchema} 로 결정을 보냄 → main 이
 * long-poll 응답으로 {@link SessionGateResult} 를 돌려주면 훅이 그 내용을
 * additionalContext 로 세션에 주입한다.
 *
 * Renderer-only 영역에서는 동일 타입을 type-only 로 미러링한다(런타임 공유 금지).
 */

/** Control plane route the SessionStart hook long-polls. */
export const SESSION_GATE_ROUTE = '/v1/session/start';

export type SessionGateChoice = 'create' | 'select' | 'skip';

/** 선택/생성된 Jira 이슈의 최소 정보. */
export const sessionGateIssueSchema = z.object({
  key: z.string().min(1),
  summary: z.string().default(''),
  url: z.string().default(''),
});
export type SessionGateIssue = z.infer<typeof sessionGateIssueSchema>;

/**
 * Renderer → main: 활성 게이트 요청에 대한 사용자 결정.
 * create/select 는 (렌더러가 이미 생성·선택을 끝낸) 최종 이슈를 함께 보낸다.
 */
export const sessionGateResolveRequestSchema = z.discriminatedUnion('choice', [
  z.object({
    requestId: z.string().min(1),
    choice: z.literal('create'),
    issue: sessionGateIssueSchema,
  }),
  z.object({
    requestId: z.string().min(1),
    choice: z.literal('select'),
    issue: sessionGateIssueSchema,
  }),
  z.object({
    requestId: z.string().min(1),
    choice: z.literal('skip'),
  }),
]);
export type SessionGateResolveRequest = z.infer<typeof sessionGateResolveRequestSchema>;

/** main → renderer: 모달을 열어라. */
export type SessionGateOpenEvent = {
  requestId: string;
  workspaceId: string;
  cwd: string;
  source: string;
};

/** main → renderer: 해당 요청은 끝났으니 모달을 닫아라(타임아웃/해소 공통). */
export type SessionGateCloseEvent = {
  requestId: string;
};

/** main → hook(long-poll 응답): 세션에 주입할 컨텍스트. */
export type SessionGateResult = {
  additionalContext: string;
  ticketKey: string | null;
};

export type SessionGateResolveResponse = {
  accepted: boolean;
};
