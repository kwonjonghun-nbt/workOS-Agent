import { ApiError } from '../infra/error';
import type {
  BulkReplaceRequest,
  BulkReplaceResponse,
  LabelNote,
  SaveLabelNotesRequest,
  SearchByLabelRequest,
  SearchByLabelResponse,
  SuggestLabelRequest,
  SuggestLabelResponse,
  UpdateIssueLabelsRequest,
} from '../contracts/jira-labels';
import {
  normalizeBaseUrl,
  parseProjectKeys,
  type JiraConfig,
} from '../domain/jira';
import type { JiraRepository } from '../repositories/jira.repo';
import type { LabelNotesRepository } from '../repositories/jira-label-notes.repo';
import type { LlmCliRepository } from '../repositories/llm-cli.repo';
import type { ExtensionService } from './extension.service';

const LOG = (...a: unknown[]) => console.log('[jira-label.service]', ...a);

const JIRA_EXTENSION_ID = 'workos.jira';

export class JiraLabelService {
  constructor(
    private readonly notesRepo: LabelNotesRepository,
    private readonly jiraRepo: JiraRepository,
    private readonly llm: LlmCliRepository,
    private readonly extensionService: ExtensionService,
  ) {}

  async getNotes(): Promise<LabelNote[]> {
    return this.notesRepo.load();
  }

  async saveNotes(req: SaveLabelNotesRequest): Promise<LabelNote[]> {
    const dedup = new Map<string, LabelNote>();
    for (const n of req.notes) {
      dedup.set(n.label, { ...n, updatedAt: new Date().toISOString() });
    }
    const next = Array.from(dedup.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'ko'),
    );
    await this.notesRepo.save(next);
    return next;
  }

  async searchByLabel(req: SearchByLabelRequest): Promise<SearchByLabelResponse> {
    const config = await this.resolveConfig();
    return this.jiraRepo.searchByLabel(config, req.projectKey, req.label);
  }

  async bulkReplace(req: BulkReplaceRequest): Promise<BulkReplaceResponse> {
    const config = await this.resolveConfig();
    const successKeys: string[] = [];
    const failed: { key: string; error: string }[] = [];
    for (const key of req.issueKeys) {
      try {
        await this.jiraRepo.replaceLabelOnIssue(
          config,
          key,
          req.oldLabel,
          req.newLabel,
        );
        successKeys.push(key);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        LOG('replace failed for', key, ':', message);
        failed.push({ key, error: message });
      }
    }
    return { successKeys, failed };
  }

  async updateIssueLabels(req: UpdateIssueLabelsRequest): Promise<void> {
    const config = await this.resolveConfig();
    await this.jiraRepo.setIssueLabels(config, req.issueKey, req.labels);
  }

  async suggestLabel(req: SuggestLabelRequest): Promise<SuggestLabelResponse> {
    const prompt = buildSuggestPrompt(req);
    const text = await this.llm.runText(prompt, { model: req.model });
    return parseSuggestResponse(text, req.candidates.map((c) => c.label));
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

export function buildSuggestPrompt(req: SuggestLabelRequest): string {
  const candidates = req.candidates
    .map((c) =>
      c.description
        ? `- "${c.label}": ${c.description}`
        : `- "${c.label}"`,
    )
    .join('\n');
  const description = req.description.slice(0, 2000);
  return [
    '당신은 Jira 이슈에 가장 적절한 라벨을 골라주는 도우미입니다.',
    '아래 이슈 정보를 읽고 후보 라벨 중에서 1~3개를 선택하세요.',
    '반드시 JSON 만 한 줄로 출력하세요: {"labels": ["..."], "reason": "한 문장(한국어)"}.',
    'JSON 외 텍스트, 마크다운, 코드 펜스를 절대 출력하지 마세요.',
    '',
    `# 이슈 ${req.issueKey}`,
    `요약: ${req.summary}`,
    description ? `설명:\n${description}` : '설명: (없음)',
    '',
    '# 후보 라벨',
    candidates || '(후보 없음 — 빈 labels 배열을 반환)',
  ].join('\n');
}

export function parseSuggestResponse(
  raw: string,
  validLabels: string[],
): SuggestLabelResponse {
  const trimmed = raw.trim();
  // Strip code fences if the model ignored instructions.
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new ApiError('INTERNAL', `LLM 응답을 파싱할 수 없습니다: ${trimmed.slice(0, 120)}`);
  }
  try {
    const parsed = JSON.parse(fenced.slice(start, end + 1)) as {
      labels?: unknown;
      reason?: unknown;
    };
    const validSet = new Set(validLabels);
    const labels = Array.isArray(parsed.labels)
      ? parsed.labels.map(String).filter((l) => validSet.has(l))
      : [];
    const reason = typeof parsed.reason === 'string' ? parsed.reason : '';
    return { labels, reason };
  } catch (err) {
    throw new ApiError(
      'INTERNAL',
      `LLM 응답 JSON 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
