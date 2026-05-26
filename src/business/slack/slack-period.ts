/**
 * Helpers for translating UI period presets into unix-second windows used by
 * the Slack Web API. Lives in the business layer so the presentation layer
 * stays free of date math.
 */

export type SlackPeriodPreset = 'today' | '24h' | '7d' | '30d' | 'custom';

export function presetToWindow(
  preset: Exclude<SlackPeriodPreset, 'custom'>,
  now: Date = new Date(),
): { fromUnix: number; toUnix: number } {
  const toUnix = Math.floor(now.getTime() / 1000);
  if (preset === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { fromUnix: Math.floor(start.getTime() / 1000), toUnix };
  }
  const hoursByPreset: Record<typeof preset, number> = {
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30,
  } as Record<typeof preset, number>;
  const hours = hoursByPreset[preset];
  return { fromUnix: toUnix - hours * 3600, toUnix };
}

export function customRangeToWindow(
  fromDate: string,
  toDate: string,
): { fromUnix: number; toUnix: number } | null {
  const fromMs = Date.parse(fromDate);
  const toMs = Date.parse(toDate);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  // Snap "to" to end-of-day so a same-day range still covers the picked date.
  const toEnd = new Date(toMs);
  toEnd.setHours(23, 59, 59, 999);
  if (fromMs >= toEnd.getTime()) return null;
  return {
    fromUnix: Math.floor(fromMs / 1000),
    toUnix: Math.floor(toEnd.getTime() / 1000),
  };
}

/**
 * Slack 메시지 permalink 에서 채널 ID + 스레드 ts 를 함께 추출.
 * 예: https://workspace.slack.com/archives/C12345678/p1700000000123456?thread_ts=...
 * raw ts 만 들어온 경우는 채널 정보를 알 수 없어 null 을 반환한다.
 */
export function parseThreadRefFromInput(
  raw: string,
): { channelId: string; threadTs: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = trimmed.match(
    /\/archives\/([CDG][A-Z0-9]+)\/p(\d{10})(\d{6})/,
  );
  if (!m) return null;
  return { channelId: m[1], threadTs: `${m[2]}.${m[3]}` };
}

export function parseThreadTsFromInput(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // Accept either the raw `1700000000.123456` ts or a permalink ending in
  // `/p1700000000123456` (Slack format).
  const permalinkMatch = trimmed.match(/\/p(\d{10})(\d{6})/);
  if (permalinkMatch) {
    return `${permalinkMatch[1]}.${permalinkMatch[2]}`;
  }
  if (/^\d{10}\.\d{1,6}$/.test(trimmed)) return trimmed;
  return undefined;
}
