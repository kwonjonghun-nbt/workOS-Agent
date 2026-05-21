import { ApiError } from '../infra/error';
import type {
  GenerateReportRequest,
  GenerateReportResponse,
  GetReportResponse,
  ReportMeta,
  SaveReportRequest,
} from '../contracts/jira-reports';
import type { LabelNote } from '../contracts/jira-labels';
import type { ReportsRepository } from '../repositories/jira-reports.repo';
import type { JiraSnapshotRepository } from '../repositories/jira-snapshot.repo';
import type { LabelNotesRepository } from '../repositories/jira-label-notes.repo';
import type { LlmCliRepository } from '../repositories/llm-cli.repo';
import type { NormalizedIssue } from '../contracts/jira-snapshot';

const LOG = (...a: unknown[]) => console.log('[jira-report.service]', ...a);

export class JiraReportService {
  constructor(
    private readonly reports: ReportsRepository,
    private readonly snapshot: JiraSnapshotRepository,
    private readonly labelNotes: LabelNotesRepository,
    private readonly llm: LlmCliRepository,
  ) {}

  async list(): Promise<ReportMeta[]> {
    return this.reports.list();
  }

  async get(filename: string): Promise<GetReportResponse> {
    const content = await this.reports.get(filename);
    return { filename, content };
  }

  async save(req: SaveReportRequest): Promise<void> {
    await this.reports.save(req.filename, req.content);
  }

  async delete(filename: string): Promise<void> {
    await this.reports.delete(filename);
  }

  async generate(req: GenerateReportRequest): Promise<GenerateReportResponse> {
    const latest = await this.snapshot.getLatest();
    if (!latest) {
      throw new ApiError(
        'VALIDATION',
        '아직 동기화된 데이터가 없습니다. 먼저 동기화를 실행하세요.',
      );
    }
    const startMs = Date.parse(req.startDate);
    const endMs = Date.parse(req.endDate);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
      throw new ApiError('VALIDATION', '날짜 범위가 올바르지 않습니다.');
    }
    const filtered = latest.issues.filter((i) =>
      isInRange(i, startMs, endMs + 24 * 60 * 60 * 1000 - 1),
    );
    if (filtered.length === 0) {
      throw new ApiError(
        'VALIDATION',
        '지정한 기간에 매칭되는 이슈가 없습니다.',
      );
    }
    const notes = await this.labelNotes.load();
    // 사용자 이름은 항상 currentUser — 스냅샷의 assignee 필드에서 추출.
    const assignee =
      filtered.find((i) => i.assignee)?.assignee ?? '나';
    LOG(
      'generate report:',
      filtered.length,
      'issue(s),',
      notes.length,
      'label note(s), assignee=',
      assignee,
    );
    const prompt = buildReportPrompt({
      assignee,
      startDate: req.startDate,
      endDate: req.endDate,
      labelNotes: notes,
      issues: filtered,
    });
    const content = await this.llm.runText(prompt, { model: req.model });
    return { content: content.trim() };
  }
}

function isInRange(issue: NormalizedIssue, startMs: number, endMs: number): boolean {
  const updated = Date.parse(issue.updated);
  if (Number.isFinite(updated) && updated >= startMs && updated <= endMs) return true;
  const created = Date.parse(issue.created);
  if (Number.isFinite(created) && created >= startMs && created <= endMs) return true;
  return false;
}

// ---------- prompt building ----------

/** client-jira 와 동일한 8섹션 구조 + 라벨 정의 + 작성 규칙. */
export type BuildReportPromptArgs = {
  assignee: string;
  startDate: string;
  endDate: string;
  /**
   * 「라벨 관리」 탭에 사용자가 직접 등록한 라벨 메모. 비어 있으면 프롬프트는
   * "사용자가 라벨 정의를 등록하지 않았다" 는 사실을 명시하고, LLM 이 임의의
   * 라벨 분류 체계를 만들어내지 않도록 라벨 관련 섹션을 보수적으로 처리한다.
   */
  labelNotes: LabelNote[];
  issues: NormalizedIssue[];
};

function renderLabelDefinitionsSection(notes: LabelNote[]): string {
  if (notes.length === 0) {
    return [
      '## 라벨 관리 기준',
      '',
      '**현재 「라벨 관리」 탭에 등록된 라벨 정의가 없습니다.**',
      '- 라벨 분류 체계를 임의로 만들어내지 마세요.',
      '- 라벨별 통계는 데이터에 등장한 라벨 문자열 그대로 집계만 하세요.',
      '- "6.2 라벨 누락 티켓" / "6.3 라벨 분류 적절성 검토" 항목은 다음 한 줄로 대체하세요:',
      '  > 라벨 관리 탭에 등록된 라벨 정의가 없어 추천/검토를 보류합니다. 먼저 라벨 메모를 등록해주세요.',
    ].join('\n');
  }
  const body = notes
    .map((n) => {
      const desc = (n.description || '').trim();
      return desc
        ? `### ${n.label}\n\n${desc}`
        : `### ${n.label}\n\n(설명 미입력)`;
    })
    .join('\n\n');
  return [
    '## 라벨 관리 기준 (사용자가 「라벨 관리」 탭에서 직접 등록한 정의)',
    '',
    `아래는 사용자가 직접 작성·관리하는 ${notes.length}개의 라벨 정의입니다. **라벨 추천/검토/분류에 대한 모든 판단은 반드시 이 정의만을 근거로 해야 합니다.** 여기 등록되지 않은 라벨을 LLM 이 새로 만들어 추천하지 마세요. 정의가 모호하다고 느껴지면 그대로 인용하고, 자의적으로 의미를 확장하지 마세요.`,
    '',
    body,
  ].join('\n');
}

/**
 * Build the AI report-generation prompt. The data section is inlined as JSON
 * so the claude CLI invocation is self-contained (no file attachments).
 */
export function buildReportPrompt(args: BuildReportPromptArgs): string {
  const { assignee, startDate, endDate, issues, labelNotes } = args;
  const dataJson = JSON.stringify(issues.map(toExport), null, 2);
  const hasLabelNotes = labelNotes.length > 0;

  return `아래 Jira 이슈 데이터를 분석하여 담당자의 업무 성과 리포트를 마크다운 형식으로 작성해주세요.
단순 수치 나열이 아니라, 각 티켓의 제목·라벨을 꼼꼼히 읽고 "이 사람이 이 기간에 실제로 어떤 일을 했는지"를 서술형으로 분석해주세요.

## 입력 정보
- 기간: ${startDate} ~ ${endDate}
- 담당자: ${assignee}
- 데이터: 본 프롬프트 하단의 "이슈 데이터 (JSON)" 블록에 모두 포함되어 있습니다. 외부 파일이나 별도 첨부 없이 이 데이터만 사용해주세요.

${renderLabelDefinitionsSection(labelNotes)}

## 티켓 상세 정보 기준

좋은 티켓에는 다음 항목들이 포함되어야 합니다:
- **배경(Background)**: 이 작업이 왜 필요한지, 어떤 문제나 요구사항에서 시작되었는지
- **작업 목표(Goal)**: 이 티켓을 통해 달성하려는 구체적인 목표
- **완료 기준(Acceptance Criteria)**: 이 티켓이 "완료"되었다고 판단하는 명확한 기준
- **참고 자료(References)**: 관련 디자인, 문서, 링크 등

(참고: 현재 이 데이터셋에는 description 본문이 동기화되어 있지 않을 수 있습니다. 그럴 경우 6.1 항목은 "description 부재" 자체를 누락 항목으로 다뤄주세요.)

## 리포트 형식

# ${assignee} 업무 리포트 (${startDate} ~ ${endDate})

> 기간: ${startDate} ~ ${endDate} | 담당자: ${assignee}

## 1. 수치 요약

| 항목 | 수치 |
|------|------|
| 총 이슈 | N건 |
| 완료 | N건 (%) |
| 미완료 | N건 |
| 총 스토리포인트 | N점 (완료 N점) |

### 이슈타입별
| 타입 | 전체 | 완료 | 완료율 |
|------|------|------|--------|

### 라벨별
| 라벨 | 전체 | 완료 | 완료율 |
|------|------|------|--------|

### 우선순위별
| 우선순위 | 전체 | 완료 | 완료율 |
|----------|------|------|--------|

## 2. 주요 작업 내용

티켓 제목을 기반으로 이 기간에 수행한 작업을 **카테고리별로 묶어** 서술해주세요.
예시 카테고리: 신규 기능 개발, 버그 수정, 리팩토링, 성능 개선, UI/UX 개선, 인프라/DevOps, 테스트, 문서화 등

각 카테고리마다:
- 어떤 작업들을 했는지 구체적으로 설명
- 관련 티켓 키를 괄호로 표기 (예: PROJ-123)
- 기술적으로 어떤 의미가 있는 작업인지 간단히 해석

## 3. 기술적 성과 분석

이 기간의 작업들을 종합하여:
- **핵심 기술 성과**: 가장 임팩트가 큰 작업 2~3개를 선정하고, 왜 중요한지 설명
- **기술 역량 활용**: 어떤 기술 스택/영역에서 주로 작업했는지 (프론트엔드, 백엔드, DB, 인프라 등)
- **코드 품질 기여**: 리팩토링, 테스트 추가, 기술 부채 해소 등이 있었는지

## 4. 업무 균형 분석

라벨과 이슈타입 분포를 기반으로:
- **집중 영역**: 이 기간에 가장 많은 시간을 투자한 영역
- **상대적 부족 영역**: 신경 쓰지 못한 영역 (예: 기능 개발에 집중했지만 테스트/문서화/리팩토링은 부족)
- **균형 제안**: 다음 기간에 보완하면 좋을 영역

## 5. 미완료·지연 이슈

| 이슈 키 | 제목 | 상태 | 우선순위 | 지연 사유 추정 |
|----------|------|------|----------|----------------|

각 지연 이슈에 대해 어떤 조치가 필요한지 제안해주세요.

## 6. 티켓 품질 점검

### 6.1 상세 정보 미흡 티켓
각 티켓을 확인하여, 위 "티켓 상세 정보 기준"(배경/작업 목표/완료 기준/참고 자료)이 누락되었거나 미흡한 티켓을 나열해주세요.

각 티켓에 대해:
- **이슈 키 / 제목**
- **현재 상태**: 어떤 정보가 누락됐는지 요약
- **누락 항목**: 배경/작업 목표/완료 기준/참고 자료 중 빠진 것
- **개선 제안**: 어떤 내용을 추가하면 좋을지 구체적으로 제안
- **심각도**: 높음/중간/낮음 (복잡한 작업인데 정보가 없으면 높음, 단순 문구 수정 같은 자명한 티켓은 낮음)

### 6.2 라벨 누락 티켓
${
  hasLabelNotes
    ? `라벨이 없는 티켓을 찾아 위 "라벨 관리 기준"에 **정의된 라벨들 중에서만** 적절한 라벨을 추천해주세요. 정의되지 않은 라벨을 새로 만들어 추천하지 마세요.

| 이슈 키 | 제목 | 추천 라벨 | 추천 사유 (어떤 정의 항목에 부합하는지 명시) |
|----------|------|-----------|-----------|

라벨이 여러 개 해당되면 모두 표기해주세요.`
    : '> 라벨 관리 탭에 등록된 라벨 정의가 없어 추천을 보류합니다. 먼저 라벨 메모를 등록해주세요.'
}

### 6.3 라벨 분류 적절성 검토
${
  hasLabelNotes
    ? `이미 라벨이 있는 티켓 중, 티켓 제목·타입과 위 "라벨 관리 기준"의 정의가 맞지 않는 경우:

| 이슈 키 | 제목 | 현재 라벨 | 문제점 (어떤 정의와 충돌하는지) | 권장 라벨 |
|----------|------|-----------|--------|-----------|`
    : '> 라벨 관리 탭에 등록된 라벨 정의가 없어 검토를 보류합니다.'
}

## 7. 총평

5~8문장으로 이 기간의 업무를 종합 평가해주세요:
- 전반적인 생산성과 완성도
- 가장 주목할 성과
- 개선이 필요한 부분
- 티켓 관리 품질에 대한 피드백
- 다음 기간에 대한 제안

## 8. 인사이트 / 리스크

위 6개 섹션을 통해 발견한 패턴 중 다음 기간의 의사결정에 도움이 될 인사이트와, 지금 관리하지 않으면 커질 수 있는 리스크를 각각 3개 이내로 정리해주세요.

- **인사이트**: 데이터에서 발견된 흥미로운 패턴이나 추세
- **리스크**: 미완료 누적/라벨 무관리/특정 영역 편중 등 방치 시 문제가 될 신호

---

## 작성 규칙
1. 수치는 정확히 계산하고, 완료율은 소수점 1자리까지 표시
2. 티켓 제목을 반드시 읽고, 실제 작업 성격을 파악하여 서술
3. 단순 나열이 아닌, 분석과 해석이 담긴 리포트 작성
4. 라벨의 의미는 **오직 위 "라벨 관리 기준"(사용자가 「라벨 관리」 탭에 등록한 정의)만** 참조하세요. 일반 상식이나 라벨 이름의 어감으로 의미를 추측하지 마세요.
5. 라벨 추천·검토는 반드시 등록된 라벨 정의 안에서만 이루어져야 합니다. 정의되지 않은 라벨을 새로 만들어 추천하지 마세요.
6. 테이블은 마크다운 형식으로 작성
7. 결과물은 .md 파일로 저장할 수 있는 순수 마크다운만 출력 — 코드 펜스로 감싸지 마세요
8. 데이터에 없는 사실(예: 코드 변경 내역, 코드 리뷰, PR)을 추정해서 단정하지 말고, 추정일 경우 "추정"임을 표기

---

## 이슈 데이터 (JSON)

\`\`\`json
${dataJson}
\`\`\`
`;
}

function toExport(issue: NormalizedIssue) {
  return {
    key: issue.key,
    summary: issue.summary,
    status: issue.status,
    statusCategory: issue.statusCategory,
    assignee: issue.assignee,
    priority: issue.priority,
    issueType: issue.issueType,
    storyPoints: issue.storyPoints,
    labels: issue.labels,
    parentKey: issue.parentKey,
    created: issue.created,
    updated: issue.updated,
    startDate: issue.startDate,
    dueDate: issue.dueDate,
    url: issue.url,
  };
}
