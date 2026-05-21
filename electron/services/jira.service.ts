import { ApiError } from '../infra/error';
import {
  mapAtlassianIssue,
  normalizeBaseUrl,
  parseProjectKeys,
  type JiraConfig,
} from '../domain/jira';
import type {
  ListMyIssuesResponse,
  TestConnectionResponse,
} from '../contracts/jira';
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
