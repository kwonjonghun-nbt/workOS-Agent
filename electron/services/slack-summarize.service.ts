import { ApiError } from '../infra/error';
import type {
  SlackSummaryTemplate,
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
        template: req.template ?? 'decision',
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
  template: SlackSummaryTemplate;
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
  const { channelName, isThread, fromUnix, toUnix, focus, template, messages } = args;
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
    templateBlock(template),
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

function templateBlock(t: SlackSummaryTemplate): string {
  switch (t) {
    case 'decision':
      return [
        '## 요약 형식 (결정 중심)',
        '',
        '### 안건',
        '- 이 스레드/채널에서 다뤄진 주제 1~3개. 핵심을 한 줄씩.',
        '',
        '### 결정사항',
        '- 명시적/암묵적으로 합의된 항목을 불릿으로. 결정자 표기.',
        '- 합의가 없었다면 "결정 없음" 으로 적어주세요.',
        '',
        '### 액션 아이템',
        '- "누가, 무엇을, 언제까지" 형태로. 미정 항목은 "담당자 미정" / "기한 미정" 표기.',
        '',
        '### 미해결/오픈 이슈',
        '- 결론이 안 난 질문, 의견 충돌, 추가 정보가 필요한 항목.',
        '',
      ].join('\n');
    case 'timeline':
      return [
        '## 요약 형식 (시간순 흐름)',
        '',
        '### 한줄 요약',
        '- 전체 논의가 어디서 시작해 어디로 갔는지 한 문장.',
        '',
        '### 단계별 진행',
        '- 시간순으로 의미 있는 전환점을 단계로 나눠 정리.',
        '- 각 단계는 "**[MM-DD HH:mm] 화자 — 단계명**: 무슨 일이 있었는지" 형태.',
        '- 5~10단계 정도가 적당. 무의미한 잡담은 생략.',
        '',
        '### 최종 상태',
        '- 마지막 시점에 무엇이 결정/보류/오픈된 상태인지.',
        '',
      ].join('\n');
    case 'tldr':
      return [
        '## 요약 형식 (TL;DR)',
        '',
        '딱 3개 불릿으로만 작성해주세요. 그 외 섹션은 만들지 마세요.',
        '',
        '- **무엇이**: 어떤 안건/이슈가 있었는지',
        '- **왜**: 그게 왜 논의됐는지 (배경/계기)',
        '- **결론**: 최종적으로 어떻게 됐는지 (또는 "결론 미정")',
        '',
        '각 불릿은 1~2 문장. 군더더기 없이.',
        '',
      ].join('\n');
    case 'issue':
      return [
        '## 요약 형식 (이슈/트러블슈팅)',
        '',
        '### 문제',
        '- 무슨 일이 발생했는지. 증상/현상.',
        '',
        '### 영향',
        '- 누가/어디까지 영향을 받았는지. 범위와 심각도.',
        '',
        '### 원인 (밝혀진 부분)',
        '- 메시지에서 식별된 원인. 가설 단계라면 "가설:" 접두.',
        '',
        '### 시도된 해결',
        '- 어떤 조치가 시도됐고 결과가 어땠는지 시간순으로.',
        '',
        '### 현재 상태',
        '- 해결 / 부분 해결 / 회피 / 미해결 중 하나로 명시.',
        '',
        '### 후속조치',
        '- 재발 방지/모니터링/문서화 등 남은 일. 담당자 표기.',
        '',
      ].join('\n');
    case 'qa':
      return [
        '## 요약 형식 (Q&A)',
        '',
        '질문-답변 페어로만 정리해주세요. 같은 질문에 여러 답이 있으면 묶어주세요.',
        '',
        '### Q1. [질문 요약]',
        '- **묻는 사람 — MM-DD HH:mm**',
        '- 질문 본문 요약',
        '',
        '**A.**',
        '- 답변자별로 답변 핵심 (여러 명이면 각각).',
        '- 코드/링크/파일이 언급됐다면 그대로 인용.',
        '',
        '### Q2. ...',
        '',
        '명확한 답이 나오지 않은 질문은 마지막에 "### 미답변 질문" 으로 묶어주세요.',
        '',
      ].join('\n');
    case 'perspectives':
      return [
        '## 요약 형식 (입장 정리)',
        '',
        '### 쟁점',
        '- 무엇을 두고 의견이 갈렸는지. 1~3개.',
        '',
        '각 쟁점마다 아래 구조 반복:',
        '',
        '### 쟁점 N. [한 줄 제목]',
        '',
        '**찬성/A 입장**',
        '- 누가 — 핵심 주장 (근거 포함)',
        '',
        '**반대/B 입장**',
        '- 누가 — 핵심 주장 (근거 포함)',
        '',
        '**합의된 부분**',
        '- 양쪽이 동의한 지점 (있다면). 없으면 "합의 없음".',
        '',
        '**남은 차이**',
        '- 여전히 갈리는 부분.',
        '',
      ].join('\n');
  }
}
