import type { SlackChannelKind } from '../contracts/slack';

/** Pure types/helpers for the Slack Digest extension. No I/O. */

export type SlackTokenMode = 'user' | 'bot';

export type SlackAuthConfig = {
  /** Which token to use when both are present. */
  mode: SlackTokenMode;
  userToken: string;
  botToken: string;
  /** Comma/whitespace separated emoji names the user wants to track. */
  defaultEmojis: string;
};

export function pickActiveToken(cfg: SlackAuthConfig): {
  token: string;
  mode: SlackTokenMode;
} | null {
  if (cfg.mode === 'user') {
    if (cfg.userToken) return { token: cfg.userToken, mode: 'user' };
    if (cfg.botToken) return { token: cfg.botToken, mode: 'bot' };
    return null;
  }
  if (cfg.botToken) return { token: cfg.botToken, mode: 'bot' };
  if (cfg.userToken) return { token: cfg.userToken, mode: 'user' };
  return null;
}

export function parseEmojiList(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/^:+|:+$/g, ''))
    .filter((s) => s.length > 0);
}

export function classifyChannel(raw: {
  is_im?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
  is_group?: boolean;
}): SlackChannelKind {
  if (raw.is_im) return 'im';
  if (raw.is_mpim) return 'mpim';
  if (raw.is_group) return 'group';
  if (raw.is_private) return 'private';
  return 'public';
}

/** Slack ts strings encode a unix timestamp with microsecond precision. */
export function tsToIso(ts: string): string {
  const seconds = Number(ts.split('.')[0]);
  if (!Number.isFinite(seconds)) return new Date(0).toISOString();
  return new Date(seconds * 1000).toISOString();
}
