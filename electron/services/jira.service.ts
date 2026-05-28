import { ApiError } from '../infra/error';
import {
  mapAtlassianIssue,
  normalizeBaseUrl,
  parseProjectKeys,
  type JiraConfig,
} from '../domain/jira';
import type {
  CreateIssueResponse,
  GetIssueDetailResponse,
  GetTransitionsResponse,
  ListIssueChildrenResponse,
  ListMyIssuesResponse,
  TestConnectionResponse,
  TransitionIssueResponse,
} from '../contracts/jira';
import { adfToMarkdown } from '../domain/ticket-template';
import type { JiraRepository } from '../repositories/jira.repo';
import type { ExtensionService } from './extension.service';

const LOG = (...args: unknown[]) => console.log('[jira.service]', ...args);

const JIRA_EXTENSION_ID = 'workos.jira';

/**
 * Use-case layer for Jira integration. Reads connection settings from the
 * Jira extension's settings (decrypted token included) and delegates the HTTP
 * call to the repository.
 */
export class JiraService {
  constructor(
    private readonly repo: JiraRepository,
    private readonly extensionService: ExtensionService,
  ) {}

  async listMyIssues(maxResults: number): Promise<ListMyIssuesResponse> {
    const enabled = await this.extensionService.isEnabled(JIRA_EXTENSION_ID);
    if (!enabled) {
      throw new ApiError(
        'VALIDATION',
        'Jira 확장이 비활성화되어 있습니다. Extensions 패널에서 활성화하세요.',
      );
    }
    const settings = await this.extensionService.getSettings(JIRA_EXTENSION_ID);
    const config = this.toConfig(settings);
    LOG(
      'listMyIssues baseUrl=', config.baseUrl,
      'email=', config.email,
      'projectKeys=', config.projectKeys,
      'maxResults=', maxResults,
    );

    const { raw } = await this.repo.searchAssignedIssues(config, maxResults);
    const issues = raw.map((r) => mapAtlassianIssue(r, config.baseUrl));
    LOG('listMyIssues result:', issues.length, 'issue(s)');
    return { issues, total: issues.length };
  }

  async getIssueDetail(issueKey: string): Promise<GetIssueDetailResponse> {
    const enabled = await this.extensionService.isEnabled(JIRA_EXTENSION_ID);
    if (!enabled) {
      throw new ApiError(
        'VALIDATION',
        'Jira 확장이 비활성화되어 있습니다. Extensions 패널에서 활성화하세요.',
      );
    }
    const settings = await this.extensionService.getSettings(JIRA_EXTENSION_ID);
    const config = this.toConfig(settings);
    LOG('getIssueDetail', issueKey);
    const issue = await this.repo.getIssueDetail(config, issueKey);
    return {
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      parentKey: issue.parentKey,
      descriptionMarkdown: adfToMarkdown(issue.description),
    };
  }

  async testConnection(): Promise<TestConnectionResponse> {
    const enabled = await this.extensionService.isEnabled(JIRA_EXTENSION_ID);
    if (!enabled) {
      throw new ApiError(
        'VALIDATION',
        'Jira 확장이 비활성화되어 있습니다. Extensions 패널에서 활성화하세요.',
      );
    }
    const settings = await this.extensionService.getSettings(JIRA_EXTENSION_ID);
    const config = this.toConfig(settings);
    LOG('testConnection baseUrl=', config.baseUrl, 'email=', config.email);

    const me = await this.repo.getMyself(config);
    // Run the actual search to confirm the JQL is well-formed and tell the
    // user how many issues currently match the configured filter.
    const { raw } = await this.repo.searchAssignedIssues(config, 100);
    LOG('testConnection ok; assignedIssues=', raw.length);
    return {
      ok: true,
      accountId: me.accountId,
      displayName: me.displayName,
      emailAddress: me.emailAddress,
      baseUrl: config.baseUrl,
      projectKeys: config.projectKeys,
      matchedIssues: raw.length,
    };
  }

  async createIssue(args: {
    summary: string;
    issueType: string;
    parentKey?: string;
    description?: string;
    projectKey?: string;
  }): Promise<CreateIssueResponse> {
    await this.ensureEnabled();
    const settings = await this.extensionService.getSettings(JIRA_EXTENSION_ID);
    const config = this.toConfig(settings);
    const projectKey = (args.projectKey && args.projectKey.trim()) || config.projectKeys[0];
    if (!projectKey) {
      throw new ApiError('VALIDATION', '프로젝트 키가 설정되지 않았습니다.');
    }
    LOG('createIssue projectKey=', projectKey, 'issueType=', args.issueType, 'parentKey=', args.parentKey);
    const result = await this.repo.createIssue(config, {
      projectKey,
      summary: args.summary,
      issueType: args.issueType,
      parentKey: args.parentKey,
      description: args.description,
    });
    return {
      key: result.key,
      url: `${config.baseUrl}/browse/${result.key}`,
      issueType: result.issueType,
    };
  }

  async listIssueChildren(parentKey: string): Promise<ListIssueChildrenResponse> {
    await this.ensureEnabled();
    const settings = await this.extensionService.getSettings(JIRA_EXTENSION_ID);
    const config = this.toConfig(settings);
    LOG('listIssueChildren parentKey=', parentKey);
    const { parent, children } = await this.repo.getIssueChildren(config, parentKey);
    return { parent, children };
  }

  async getTransitions(issueKey: string): Promise<GetTransitionsResponse> {
    await this.ensureEnabled();
    const settings = await this.extensionService.getSettings(JIRA_EXTENSION_ID);
    const config = this.toConfig(settings);
    LOG('getTransitions issueKey=', issueKey);
    const transitions = await this.repo.getTransitions(config, issueKey);
    return { transitions };
  }

  async transitionIssue(
    issueKey: string,
    args: { transitionId?: string; transitionName?: string },
  ): Promise<TransitionIssueResponse> {
    await this.ensureEnabled();
    const settings = await this.extensionService.getSettings(JIRA_EXTENSION_ID);
    const config = this.toConfig(settings);
    const transitions = await this.repo.getTransitions(config, issueKey);

    // id 우선, 없으면 name 으로 fallback.
    let target: { id: string; name: string; to: string } | undefined;
    if (args.transitionId) {
      target = transitions.find((t) => t.id === args.transitionId);
    }
    if (!target && args.transitionName) {
      target = transitions.find(
        (t) => t.name.toLowerCase() === args.transitionName!.toLowerCase(),
      );
    }
    if (!target) {
      const available = transitions.map((t) => `${t.id}:${t.name}`).join(', ') || '(없음)';
      const wanted = args.transitionId ?? args.transitionName ?? '(미지정)';
      throw new ApiError(
        'VALIDATION',
        `지라 transition '${wanted}' 을 찾을 수 없습니다. 사용 가능: ${available}`,
      );
    }
    LOG('transitionIssue', issueKey, '→', target.name, '(id=', target.id, ')');
    await this.repo.transitionIssue(config, issueKey, target.id);
    return { ok: true, toStatus: target.to };
  }

  /**
   * TaskItem status → Jira transition 매핑 1건의 형태.
   * - 신규(rich): { id, name, toStatus? }
   * - 레거시(string): 값이 string 이면 { id: '', name: <string> } 으로 wrap.
   */
  /**
   * 확장 설정의 statusTransitions JSON 을 파싱해 TaskItem status → Jira transition 매핑을 반환.
   * `projectKey` 가 주어지고 statusTransitionsByProject 에 해당 프로젝트별 override 가 있으면 우선 사용.
   * 파싱 실패 시 빈 객체.
   *
   * 레거시 호환: 값이 string 이면 `{ id: '', name: <string> }` 으로 wrap.
   */
  async getStatusTransitionMap(
    projectKey?: string,
  ): Promise<Record<string, { id: string; name: string; toStatus?: string }>> {
    const settings = await this.extensionService.getSettings(JIRA_EXTENSION_ID);

    // 1) project-specific override
    if (projectKey) {
      const rawByProject = settings.statusTransitionsByProject;
      if (typeof rawByProject === 'string' && rawByProject.trim()) {
        try {
          const parsed = JSON.parse(rawByProject) as unknown;
          if (parsed && typeof parsed === 'object') {
            const byProject = (parsed as Record<string, unknown>)[projectKey];
            const normalized = normalizeTransitionMap(byProject);
            if (normalized && Object.keys(normalized).length > 0) return normalized;
          }
        } catch {
          // ignore — fall through to default
        }
      }
    }

    // 2) default
    const raw = settings.statusTransitions;
    if (typeof raw !== 'string' || !raw.trim()) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      const normalized = normalizeTransitionMap(parsed);
      if (normalized) return normalized;
    } catch {
      // ignore
    }
    return {};
  }

  private async ensureEnabled(): Promise<void> {
    const enabled = await this.extensionService.isEnabled(JIRA_EXTENSION_ID);
    if (!enabled) {
      throw new ApiError(
        'VALIDATION',
        'Jira 확장이 비활성화되어 있습니다. Extensions 패널에서 활성화하세요.',
      );
    }
  }

  private toConfig(settings: Record<string, string | number | boolean>): JiraConfig {
    const baseUrlRaw = settings.baseUrl;
    const email = settings.email;
    const token = settings.token;
    const projectKey = settings.projectKey;
    if (typeof baseUrlRaw !== 'string' || baseUrlRaw.trim() === '') {
      throw new ApiError('VALIDATION', 'baseUrl 이 설정되지 않았습니다.');
    }
    if (typeof email !== 'string' || email.trim() === '') {
      throw new ApiError('VALIDATION', 'email 이 설정되지 않았습니다.');
    }
    if (typeof token !== 'string' || token.trim() === '') {
      throw new ApiError('VALIDATION', 'API 토큰이 설정되지 않았습니다.');
    }
    if (typeof projectKey !== 'string' || projectKey.trim() === '') {
      throw new ApiError('VALIDATION', '프로젝트 키가 설정되지 않았습니다.');
    }
    const projectKeys = parseProjectKeys(projectKey);
    if (projectKeys.length === 0) {
      throw new ApiError('VALIDATION', '유효한 프로젝트 키가 없습니다.');
    }
    return {
      baseUrl: normalizeBaseUrl(baseUrlRaw),
      email: email.trim(),
      token: token.trim(),
      projectKeys,
    };
  }
}

/**
 * Parse 결과의 한 매핑 객체를 정규화한다. 값이 string 이면 `{ id: '', name }` 로 wrap,
 * 값이 객체이면 `id` / `name` / `toStatus` 만 추출. 입력이 비-객체이거나 비어있으면 null.
 */
function normalizeTransitionMap(
  parsed: unknown,
): Record<string, { id: string; name: string; toStatus?: string }> | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const out: Record<string, { id: string; name: string; toStatus?: string }> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === 'string') {
      if (v.trim()) out[k] = { id: '', name: v };
    } else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id : '';
      const name = typeof o.name === 'string' ? o.name : '';
      const toStatus = typeof o.toStatus === 'string' ? o.toStatus : undefined;
      if (id || name) out[k] = { id, name, toStatus };
    }
  }
  return out;
}
