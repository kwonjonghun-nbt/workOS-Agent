import type { SlackSummaryTemplate } from '../../api/slack';

/**
 * Display metadata for the summary templates exposed by the main process.
 * Order here is the order shown in pickers (most common first).
 */
export const SUMMARY_TEMPLATE_OPTIONS: ReadonlyArray<{
  key: SlackSummaryTemplate;
  label: string;
  icon: string;
  hint: string;
}> = [
  { key: 'decision', label: '결정 중심', icon: '✅', hint: '안건 · 결정사항 · 액션아이템 · 미결' },
  { key: 'tldr', label: 'TL;DR (3줄)', icon: '⚡', hint: '무엇이 / 왜 / 결론' },
  { key: 'timeline', label: '시간순 흐름', icon: '🕒', hint: '단계별 타임라인' },
  { key: 'issue', label: '이슈/트러블슈팅', icon: '🐛', hint: '문제 · 원인 · 시도 · 상태' },
  { key: 'qa', label: 'Q&A', icon: '❓', hint: '질문별 묶음 (Q/A)' },
  { key: 'perspectives', label: '입장 정리', icon: '⚖️', hint: '쟁점 · 찬성/반대 · 합의' },
];

export const DEFAULT_SUMMARY_TEMPLATE: SlackSummaryTemplate = 'decision';

const STORE_KEY = 'workos.slack.summaryTemplate.v1';

/** Last picked template, shared across DigestPanel and TopicsPanel. */
export function loadPreferredTemplate(): SlackSummaryTemplate {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_SUMMARY_TEMPLATE;
    if (SUMMARY_TEMPLATE_OPTIONS.some((o) => o.key === raw)) {
      return raw as SlackSummaryTemplate;
    }
    return DEFAULT_SUMMARY_TEMPLATE;
  } catch {
    return DEFAULT_SUMMARY_TEMPLATE;
  }
}

export function savePreferredTemplate(t: SlackSummaryTemplate): void {
  try {
    localStorage.setItem(STORE_KEY, t);
  } catch {
    /* quota or unavailable — silently ignore */
  }
}

export function templateLabel(t: SlackSummaryTemplate): string {
  return SUMMARY_TEMPLATE_OPTIONS.find((o) => o.key === t)?.label ?? t;
}

export function templateIcon(t: SlackSummaryTemplate): string {
  return SUMMARY_TEMPLATE_OPTIONS.find((o) => o.key === t)?.icon ?? '📝';
}
