import { ApiError } from '../infra/error';
import type {
  SummarizeRequest,
  SummarizeResponse,
} from '../contracts/slack';
import type { LlmCliRepository } from '../repositories/llm-cli.repo';
import type { SlackService } from './slack.service';

const LOG = (...a: unknown[]) => console.log('[slack-summarize]', ...a);

/**
 * Bundles the "fetch window of messages → ask claude to summarize" flow. Lives
 * apart from SlackService so the data-fetch use-case stays free of LLM deps.
 */
export class SlackSummarizeService {
  constructor(
    private readonly slack: SlackService,
    private readonly llm: LlmCliRepository,
  ) {}

  async summarize(req: SummarizeRequest): Promise<SummarizeResponse> {
    try {
      const fetched = await this.slack.fetchMessages({
        channelId: req.channelId,
        threadTs: req.threadTs,
        fromUnix: req.fromUnix,
        toUnix: req.toUnix,
        maxMessages: 500,
      });
      if (!fetched.ok) return { ok: false, error: fetched.error };
      if (fetched.messages.length === 0) {
        return {
          ok: false,
          error: '해당 기간에 메시지가 없습니다. 기간을 늘리거나 다른 채널을 선택하세요.',
        };
      }
      const prompt = buildSummaryPrompt({
        channelName: fetched.channelName,
        isThread: !!req.threadTs,
        fromUnix: req.fromUnix,
        toUnix: req.toUnix,
        focus: req.focus?.trim() ?? '',
        messages: fetched.messages,
      });
      LOG(
        'summarize channel=', req.channelId,
        'thread=', req.threadTs ?? '-',
        'messageCount=', fetched.messages.length,
      );
      const summary = await this.llm.runText(prompt, { model: req.model });
      return {
        ok: true,
        summary: summary.trim(),
        messageCount: fetched.messages.length,
        channelName: fetched.channelName,
      };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, error: err.message };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

type PromptArgs = {
  channelName: string;
  isThread: boolean;
  fromUnix: number;
  toUnix: number;
  focus: string;
  messages: Array<{
    ts: string;
    userName: string;
    text: string;
    threadTs: string | null;
    at: string;
    reactions: Array<{ name: string; count: number }>;
  }>;
};

function buildSummaryPrompt(args: PromptArgs): string {
  const { channelName, isThread, fromUnix, toUnix, focus, messages } = args;
  const fromIso = new Date(fromUnix * 1000).toISOString();
  const toIso = new Date(toUnix * 1000).toISOString();
  const rendered = messages
    .map((m) => {
      const reactions =
        m.reactions.length > 0
          ? ` [${m.reactions.map((r) => `:${r.name}:×${r.count}`).join(' ')}]`
          : '';
      const threadMarker = m.threadTs ? ' (thread reply)' : '';
      return `- [${m.at}] ${m.userName}${threadMarker}${reactions}\n  ${m.text.replace(/\n/g, '\n  ')}`;
    })
    .join('\n');

  return [
    `아래는 Slack ${isThread ? '스레드' : '채널 "' + channelName + '"'} 의 ${fromIso} ~ ${toIso} 기간 대화 로그입니다.`,
    '이 대화를 한국어로 요약해 주세요. 단순 메시지 나열이 아니라 *맥락*과 *결정사항*을 살려 정리해 주세요.',
    '',
    '## 요약 형식',
    '',
    '### TL;DR',
    '- 3~5줄로 이 기간 대화의 핵심.',
    '',
    '### 주요 주제',
    '- 토픽별로 묶어서: 어떤 논의가 있었는지, 누가 어떤 입장이었는지, 어떻게 결론이 났는지.',
    '- 각 주제마다 핵심 메시지 1~2개의 화자/시각을 인용 (예: "권종훈 — 14:23: ...").',
    '',
    '### 결정사항',
    '- 명시적/암묵적으로 합의된 항목을 불릿으로. 결정자 표기.',
    '',
    '### 액션 아이템',
    '- "누가, 무엇을, 언제까지" 형태로. 명시되지 않았다면 "담당자 미정" 표기.',
    '',
    '### 미해결/논쟁',
    '- 결론이 안 난 질문, 의견 충돌, 추가 정보가 필요한 항목.',
    '',
    focus ? `### 사용자 요청 포커스\n${focus}\n` : '',
    '## 작성 규칙',
    '- 추측하지 마세요. 메시지에 없는 사실을 만들지 마세요.',
    '- 화자 이름은 메시지에 등장한 그대로 사용.',
    '- 시각은 한국 독자가 알아보기 쉽게 "MM-DD HH:mm" 형태로 변환.',
    '- 출력은 코드 펜스로 감싸지 말고 순수 마크다운으로.',
    '',
    '## 대화 로그',
    '',
    rendered,
  ]
    .filter((l) => l !== '')
    .join('\n');
}
