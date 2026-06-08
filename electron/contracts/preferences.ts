import { z } from 'zod';

export const ThemeModeSchema = z.enum(['dark', 'light']);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

/**
 * SessionStart 게이트 트리거 모드.
 * - always: 기본. claude 실행마다 게이트 작동. `WORKOS_GATE=off claude` 로 그 실행만 끔.
 * - flag: 옵트인. `WORKOS_GATE=on claude` 로 켠 실행에서만 게이트 작동.
 */
export const SessionGateModeSchema = z.enum(['always', 'flag']);
export type SessionGateMode = z.infer<typeof SessionGateModeSchema>;

export const PreferencesSchema = z.object({
  theme: ThemeModeSchema.optional(),
  /**
   * SessionStart Jira 게이트 활성화 여부. undefined 는 활성(기본 on)으로 취급한다.
   * MCP Setup 시 이 값에 따라 워크스페이스 .claude/settings.local.json 의
   * SessionStart 훅을 설치/제거한다.
   */
  sessionGateHook: z.boolean().optional(),
  /** 게이트 트리거 모드. undefined 는 'always'. */
  sessionGateMode: SessionGateModeSchema.optional(),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const SetThemeRequestSchema = z.object({
  theme: ThemeModeSchema,
});
export type SetThemeRequest = z.infer<typeof SetThemeRequestSchema>;

export const SetSessionGateHookRequestSchema = z.object({
  enabled: z.boolean(),
});
export type SetSessionGateHookRequest = z.infer<typeof SetSessionGateHookRequestSchema>;

export const SetSessionGateModeRequestSchema = z.object({
  mode: SessionGateModeSchema,
});
export type SetSessionGateModeRequest = z.infer<typeof SetSessionGateModeRequestSchema>;
