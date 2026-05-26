import type {
  TemplateKind,
  TemplateSection,
  TicketTemplate,
} from '../contracts/jira-ticket-template';

/**
 * 기본 템플릿 — 사용자가 명시적으로 저장하지 않은 경우 이 정의를 사용한다.
 * task / epic 의 섹션 구성이 의도적으로 다르다:
 *  - task 는 작업 단위 본문(배경/목표/AC/참고)
 *  - epic 은 상위 맥락 + 외부 산출물 링크(Wiki/Figma) + 하위 작업 범위
 */
const TASK_DEFAULT_SECTIONS: TemplateSection[] = [
  {
    key: 'background',
    title: '배경',
    description: '이 작업이 왜 필요한지, 어떤 문제·요구사항에서 시작됐는지.',
    required: true,
    hint: '맥락 1~3문장. 관련 이슈/이전 결정이 있다면 인용.',
  },
  {
    key: 'goal',
    title: '작업 목표',
    description: '이 티켓을 통해 달성하려는 구체적 목표.',
    required: true,
    hint: '"무엇을 해낸다" 형태의 한두 문장.',
  },
  {
    key: 'acceptance',
    title: '완료 기준 (AC)',
    description: '이 티켓이 완료되었다고 판단할 수 있는 명확한 체크리스트.',
    required: true,
    hint: '체크박스 형식 권장. 측정 가능하게 작성.',
  },
  {
    key: 'references',
    title: '참고 자료',
    description: '관련 문서·디자인·이전 PR·이슈 링크.',
    required: false,
    hint: '없으면 "해당 없음" 으로 명시.',
  },
];

const EPIC_DEFAULT_SECTIONS: TemplateSection[] = [
  {
    key: 'overview',
    title: '개요',
    description: '이 에픽이 다루는 범위를 한 문단으로 요약.',
    required: true,
    hint: '3~5문장. 비전공자도 이해할 수 있게.',
  },
  {
    key: 'problem',
    title: '배경 / 해결하려는 문제',
    description: '왜 이 에픽이 지금 필요한지. 사용자/비즈니스 임팩트.',
    required: true,
    hint: '데이터/사용자 피드백/사업 우선순위 등의 근거 인용.',
  },
  {
    key: 'goal',
    title: '목표 / 성공 지표',
    description: '에픽 종료 시점에 달성해야 하는 결과와 측정 지표.',
    required: true,
    hint: '정량 지표 권장.',
  },
  {
    key: 'wikiLink',
    title: 'Wiki 문서 링크',
    description: '관련 컨플루언스/위키 문서 링크. 필수.',
    required: true,
    hint: 'https://...atlassian.net/wiki/... 형태의 URL 1개 이상.',
  },
  {
    key: 'figmaLink',
    title: 'Figma / 디자인 링크',
    description: '디자인 산출물 링크. 필수.',
    required: true,
    hint: 'https://www.figma.com/... 형태의 URL 1개 이상.',
  },
  {
    key: 'scope',
    title: '하위 작업 범위',
    description: '이 에픽에 포함될 / 제외될 작업의 범위.',
    required: false,
    hint: '포함 vs 비포함 항목을 명시.',
  },
];

export function defaultTemplate(kind: TemplateKind, now: string): TicketTemplate {
  return {
    kind,
    name: kind === 'epic' ? '에픽 기본 템플릿' : '티켓 기본 템플릿',
    sections: kind === 'epic' ? EPIC_DEFAULT_SECTIONS : TASK_DEFAULT_SECTIONS,
    updatedAt: now,
  };
}

export function defaultTemplates(now = new Date().toISOString()): TicketTemplate[] {
  return [defaultTemplate('task', now), defaultTemplate('epic', now)];
}

// ---------- ADF ↔ Markdown 간이 변환 ----------
// Atlassian REST API 는 description 을 ADF(Atlassian Document Format) JSON 으로
// 주고받는다. 완전한 ADF 렌더러는 만들지 않고, 본 기능에 필요한 최소 변환만 한다.

type AdfNode = {
  type: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

/** ADF JSON(혹은 string) → 평문 마크다운 근사값. 미지원 노드는 텍스트만 추출. */
export function adfToMarkdown(adf: unknown): string {
  if (!adf) return '';
  if (typeof adf === 'string') return adf;
  const root = adf as AdfNode;
  if (root.type !== 'doc' || !Array.isArray(root.content)) {
    return extractText(root).trim();
  }
  return root.content.map(renderBlock).join('\n\n').trim();
}

function renderBlock(node: AdfNode): string {
  switch (node.type) {
    case 'paragraph':
      return renderInline(node.content ?? []);
    case 'heading': {
      const level = Number(node.attrs?.level ?? 1);
      const hashes = '#'.repeat(Math.max(1, Math.min(6, level)));
      return `${hashes} ${renderInline(node.content ?? [])}`;
    }
    case 'bulletList':
      return (node.content ?? [])
        .map((li) => `- ${renderInline(firstParagraph(li))}`)
        .join('\n');
    case 'orderedList':
      return (node.content ?? [])
        .map((li, i) => `${i + 1}. ${renderInline(firstParagraph(li))}`)
        .join('\n');
    case 'taskList':
      return (node.content ?? [])
        .map((item) => {
          const checked = item.attrs?.state === 'DONE' ? 'x' : ' ';
          return `- [${checked}] ${renderInline(item.content ?? [])}`;
        })
        .join('\n');
    case 'codeBlock': {
      const lang = String(node.attrs?.language ?? '');
      return ['```' + lang, renderInline(node.content ?? []), '```'].join('\n');
    }
    case 'blockquote':
      return (node.content ?? [])
        .map((c) => `> ${renderBlock(c)}`)
        .join('\n');
    case 'rule':
      return '---';
    default:
      return extractText(node);
  }
}

function firstParagraph(li: AdfNode): AdfNode[] {
  const p = (li.content ?? []).find((c) => c.type === 'paragraph');
  return p?.content ?? li.content ?? [];
}

function renderInline(nodes: AdfNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') {
        const raw = n.text ?? '';
        // marks 처리(굵게/링크) — 간단히 마크다운으로 매핑.
        const hasLink = n.marks?.find((m) => m.type === 'link');
        if (hasLink) {
          const href = String(hasLink.attrs?.href ?? '');
          return `[${raw}](${href})`;
        }
        return raw;
      }
      if (n.type === 'hardBreak') return '\n';
      return extractText(n);
    })
    .join('');
}

function extractText(node: AdfNode): string {
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(extractText).join('');
  }
  return '';
}

/**
 * Markdown → ADF doc. 본 기능에서 LLM 이 마크다운으로 만들어주는 본문을
 * Jira 에 다시 PUT 하기 위해 최소한의 매핑만 한다.
 * 지원: heading, paragraph, bulletList(- ), orderedList(1. ), 빈 줄.
 */
export function markdownToAdf(md: string): AdfNode {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: AdfNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        content: textNodes(heading[2]),
      });
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: AdfNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const txt = lines[i].replace(/^\s*[-*]\s+/, '');
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: textNodes(txt) }],
        });
        i += 1;
      }
      blocks.push({ type: 'bulletList', content: items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: AdfNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const txt = lines[i].replace(/^\s*\d+\.\s+/, '');
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: textNodes(txt) }],
        });
        i += 1;
      }
      blocks.push({ type: 'orderedList', content: items });
      continue;
    }
    // 연속된 일반 텍스트 라인을 하나의 paragraph 로 묶는다.
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'paragraph', content: textNodes(paraLines.join('\n')) });
  }
  return { type: 'doc', attrs: { version: 1 }, content: blocks };
}

function textNodes(s: string): AdfNode[] {
  // 인라인 링크 [text](url) 만 매핑. 나머지는 텍스트로.
  const out: AdfNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > lastIndex) {
      out.push({ type: 'text', text: s.slice(lastIndex, m.index) });
    }
    out.push({
      type: 'text',
      text: m[1],
      marks: [{ type: 'link', attrs: { href: m[2] } }],
    });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < s.length) {
    out.push({ type: 'text', text: s.slice(lastIndex) });
  }
  if (out.length === 0) out.push({ type: 'text', text: s });
  return out;
}

// ---------- Prompt builder ----------

export type ReviewPromptArgs = {
  issueKey: string;
  issueSummary: string;
  issueType: string;
  currentDescription: string;
  template: TicketTemplate;
  parentEpic: {
    key: string;
    summary: string;
    description: string;
  } | null;
  siblingTickets: Array<{
    key: string;
    summary: string;
    status: string;
    excerpt: string;
  }>;
};

export function buildReviewPrompt(args: ReviewPromptArgs): string {
  const {
    issueKey,
    issueSummary,
    issueType,
    currentDescription,
    template,
    parentEpic,
    siblingTickets,
  } = args;

  const sectionsBlock = template.sections
    .map(
      (s, i) =>
        `${i + 1}. **${s.title}** (key=\`${s.key}\`)${s.required ? ' *필수*' : ''}\n   - 정의: ${s.description}\n   - 작성 힌트: ${s.hint || '(없음)'}`,
    )
    .join('\n');

  const epicBlock = parentEpic
    ? `## 상위 에픽 컨텍스트 (${parentEpic.key})\n\n### 에픽 summary\n${parentEpic.summary}\n\n### 에픽 본문\n${parentEpic.description || '(본문 없음)'}`
    : '## 상위 에픽 컨텍스트\n\n(상위 에픽이 없습니다.)';

  const siblingsBlock =
    siblingTickets.length === 0
      ? '## 형제 티켓\n\n(같은 에픽의 다른 티켓이 없습니다.)'
      : `## 같은 에픽의 다른 티켓 (${siblingTickets.length}건)\n\n` +
        siblingTickets
          .map(
            (t) =>
              `### ${t.key} — ${t.summary} [${t.status}]\n${t.excerpt || '(본문 미리보기 없음)'}`,
          )
          .join('\n\n');

  return `당신은 Jira 티켓의 본문 품질을 검토·보강해주는 시니어 PM/엔지니어입니다.
아래 입력을 분석해 (1) 섹션별 격차 진단, (2) 개선 제안, (3) 적용 가능한 마크다운 본문 초안을
한 번에 JSON 으로 돌려주세요.

## 대상 이슈
- 이슈 키: ${issueKey}
- 이슈 타입: ${issueType}
- Summary: ${issueSummary}

## 적용 템플릿 (kind=${template.kind})
"${template.name}"

${sectionsBlock}

## 현재 본문
${currentDescription.trim() ? currentDescription : '(본문 없음)'}

${epicBlock}

${siblingsBlock}

## 작성 규칙
1. 출력은 **순수 JSON 한 덩어리만**. 코드 펜스/설명 텍스트 금지.
2. 같은 에픽의 형제 티켓과 중복되는 작업 범위는 \`gap\` 에 명시하고, \`proposedDescription\` 에서는 중복을 피하도록 작성.
3. 에픽 타입 검토 시 Wiki/Figma 링크 섹션은 URL 이 실제 들어있는지 \`currentValue\` 와 \`gap\` 으로 엄격히 판정. URL 누락이면 severity=high.
4. \`proposedDescription\` 은 마크다운. 섹션 제목은 \`## 섹션이름\` 형식, 체크리스트는 \`- [ ]\` 사용.
5. 데이터에 없는 사실(가짜 URL, 추정 결정사항)을 만들어내지 마라. 비어있으면 \`(추가 필요)\` 같은 placeholder 로 남길 것.
6. \`severity\`: ok(이미 충분) / low(작은 보완) / medium(중요 보완 필요) / high(필수 섹션 누락).

## 출력 JSON 스키마
{
  "overall": {
    "qualityScore": 0~100 정수 (현재 본문이 템플릿 충족 정도),
    "headline": "한 문장 진단 (한국어)",
    "missingSections": ["섹션 key 배열 — 누락/심각도 medium 이상"]
  },
  "sections": [
    {
      "key": "템플릿 섹션 key 그대로",
      "title": "템플릿 섹션 title 그대로",
      "currentValue": "현재 본문에서 이 섹션에 해당한다고 판단되는 부분 요약",
      "gap": "어떤 점이 부족한지",
      "suggestion": "구체적 보완 제안 (한국어)",
      "severity": "ok|low|medium|high"
    }
    // 템플릿의 모든 섹션을 한 번씩 포함할 것
  ],
  "proposedDescription": "## 섹션이름\\n본문...\\n\\n## 다음 섹션\\n..."
}
`;
}

export function parseReviewResponse(raw: string): {
  overall: { qualityScore: number; headline: string; missingSections: string[] };
  sections: Array<{
    key: string;
    title: string;
    currentValue: string;
    gap: string;
    suggestion: string;
    severity: 'ok' | 'low' | 'medium' | 'high';
  }>;
  proposedDescription: string;
} {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`LLM 응답에서 JSON 을 찾지 못했습니다: ${trimmed.slice(0, 200)}`);
  }
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  const overallRaw = (parsed.overall ?? {}) as Record<string, unknown>;
  const sectionsRaw = Array.isArray(parsed.sections) ? parsed.sections : [];
  const severities = new Set(['ok', 'low', 'medium', 'high']);
  return {
    overall: {
      qualityScore: clampInt(overallRaw.qualityScore, 0, 100, 0),
      headline: String(overallRaw.headline ?? ''),
      missingSections: Array.isArray(overallRaw.missingSections)
        ? overallRaw.missingSections.map(String)
        : [],
    },
    sections: sectionsRaw.map((s) => {
      const obj = s as Record<string, unknown>;
      const sev = String(obj.severity ?? 'low');
      return {
        key: String(obj.key ?? ''),
        title: String(obj.title ?? ''),
        currentValue: String(obj.currentValue ?? ''),
        gap: String(obj.gap ?? ''),
        suggestion: String(obj.suggestion ?? ''),
        severity: (severities.has(sev) ? sev : 'low') as 'ok' | 'low' | 'medium' | 'high',
      };
    }),
    proposedDescription: String(parsed.proposedDescription ?? ''),
  };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
