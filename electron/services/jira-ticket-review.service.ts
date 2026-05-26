import { ApiError } from '../infra/error';
import type {
  ApplyDescriptionRequest,
  ApplyDescriptionResponse,
  ReviewIssueRequest,
  ReviewIssueResponse,
} from '../contracts/jira-ticket-review';
import type { TemplateKind } from '../contracts/jira-ticket-template';
import {
  adfToMarkdown,
  buildReviewPrompt,
  markdownToAdf,
  parseReviewResponse,
} from '../domain/ticket-template';
import {
  normalizeBaseUrl,
  parseProjectKeys,
  type JiraConfig,
} from '../domain/jira';
import type { JiraRepository } from '../repositories/jira.repo';
import type { TicketTemplateRepository } from '../repositories/jira-ticket-template.repo';
import type { LlmCliRepository } from '../repositories/llm-cli.repo';
import type { ExtensionService } from './extension.service';

const LOG = (...a: unknown[]) => console.log('[jira-ticket-review.service]', ...a);
const JIRA_EXTENSION_ID = 'workos.jira';
const SIBLING_EXCERPT_LEN = 600;

export class JiraTicketReviewService {
  constructor(
    private readonly jiraRepo: JiraRepository,
    private readonly templateRepo: TicketTemplateRepository,
    private readonly llm: LlmCliRepository,
    private readonly extensionService: ExtensionService,
  ) {}

  async review(req: ReviewIssueRequest): Promise<ReviewIssueResponse> {
    const config = await this.resolveConfig();
    LOG('review', req.issueKey);

    // 1) 대상 이슈
    const issue = await this.jiraRepo.getIssueDetail(config, req.issueKey);
    const kind: TemplateKind = isEpicType(issue.issueType) ? 'epic' : 'task';
    const template = await this.templateRepo.get(kind);
    const currentMd = adfToMarkdown(issue.description);

    // 2) 부모 에픽 + 형제 티켓 (task 일 때만 의미가 있음. epic 이면 자기 자신의 자식들)
    let parentEpic: { key: string; summary: string; description: string } | null = null;
    let siblings: Array<{ key: string; summary: string; status: string; excerpt: string }> = [];

    if (kind === 'task' && issue.parentKey) {
      try {
        const parent = await this.jiraRepo.getIssueDetail(config, issue.parentKey);
        if (isEpicType(parent.issueType)) {
          parentEpic = {
            key: parent.key,
            summary: parent.summary,
            description: adfToMarkdown(parent.description),
          };
          const children = await this.jiraRepo.searchChildrenOfParent(
            config,
            parent.key,
            30,
          );
          siblings = children
            .filter((c) => c.key !== issue.key)
            .map((c) => ({
              key: c.key,
              summary: c.summary,
              status: c.status,
              excerpt: adfToMarkdown(c.description).slice(0, SIBLING_EXCERPT_LEN),
            }));
        }
      } catch (err) {
        LOG('parent fetch failed (ignored):', err instanceof Error ? err.message : err);
      }
    } else if (kind === 'epic') {
      // 에픽 자체를 검토 — 본인의 자식들을 컨텍스트로 사용해 "에픽이 자식들을
      // 충분히 설명하는지" 까지 판정하게 한다.
      try {
        const children = await this.jiraRepo.searchChildrenOfParent(
          config,
          issue.key,
          50,
        );
        siblings = children.map((c) => ({
          key: c.key,
          summary: c.summary,
          status: c.status,
          excerpt: adfToMarkdown(c.description).slice(0, SIBLING_EXCERPT_LEN),
        }));
      } catch (err) {
        LOG('epic children fetch failed (ignored):', err instanceof Error ? err.message : err);
      }
    }

    // 3) LLM 호출
    const prompt = buildReviewPrompt({
      issueKey: issue.key,
      issueSummary: issue.summary,
      issueType: issue.issueType,
      currentDescription: currentMd,
      template,
      parentEpic,
      siblingTickets: siblings,
    });
    const text = await this.llm.runText(prompt, { model: req.model });

    let parsed;
    try {
      parsed = parseReviewResponse(text);
    } catch (err) {
      throw new ApiError(
        'INTERNAL',
        `LLM 응답 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      issueKey: issue.key,
      kind,
      summary: issue.summary,
      issueType: issue.issueType,
      parentEpicKey: parentEpic?.key ?? null,
      overall: parsed.overall,
      sections: parsed.sections,
      proposedDescription: parsed.proposedDescription,
    };
  }

  async apply(req: ApplyDescriptionRequest): Promise<ApplyDescriptionResponse> {
    const config = await this.resolveConfig();
    const adf = markdownToAdf(req.description);
    await this.jiraRepo.updateIssueDescription(config, req.issueKey, adf);
    return { ok: true };
  }

  private async resolveConfig(): Promise<JiraConfig> {
    const enabled = await this.extensionService.isEnabled(JIRA_EXTENSION_ID);
    if (!enabled) {
      throw new ApiError('VALIDATION', 'Jira 확장이 비활성화되어 있습니다.');
    }
    const settings = await this.extensionService.getSettings(JIRA_EXTENSION_ID);
    const baseUrl = settings.baseUrl;
    const email = settings.email;
    const token = settings.token;
    const projectKey = settings.projectKey;
    if (
      typeof baseUrl !== 'string' || baseUrl.trim() === '' ||
      typeof email !== 'string' || email.trim() === '' ||
      typeof token !== 'string' || token.trim() === '' ||
      typeof projectKey !== 'string' || projectKey.trim() === ''
    ) {
      throw new ApiError('VALIDATION', 'Jira 설정이 완전하지 않습니다.');
    }
    return {
      baseUrl: normalizeBaseUrl(baseUrl),
      email: email.trim(),
      token: token.trim(),
      projectKeys: parseProjectKeys(projectKey),
    };
  }
}

function isEpicType(issueType: string): boolean {
  return issueType.trim().toLowerCase() === 'epic';
}
