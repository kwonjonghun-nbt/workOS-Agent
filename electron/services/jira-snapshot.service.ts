import { ApiError } from '../infra/error';
import {
  normalizeAtlassianIssue,
  type AtlassianIssueRaw,
} from '../domain/jira-issue';
import {
  normalizeBaseUrl,
  parseProjectKeys,
  type JiraConfig,
} from '../domain/jira';
import type {
  GetLatestResponse,
  GetMetaResponse,
  StoredData,
  SyncProgressEvent,
  TriggerSyncResponse,
} from '../contracts/jira-snapshot';
import type { JiraRepository } from '../repositories/jira.repo';
import type { JiraSnapshotRepository } from '../repositories/jira-snapshot.repo';
import type { ExtensionService } from './extension.service';

const LOG = (...a: unknown[]) => console.log('[jira-snapshot.service]', ...a);

export interface SnapshotEventSink {
  emit(event: SyncProgressEvent): void;
}

const JIRA_EXTENSION_ID = 'workos.jira';
const RAW_RETENTION_DAYS = 90;

/**
 * Use-case layer for the local Jira snapshot store. Owns the sync pipeline:
 *  1. read extension settings (decrypted) → JiraConfig
 *  2. fetch all assigned issues (paginated)
 *  3. normalize → StoredData
 *  4. persist latest + raw + meta
 *  5. emit progress events for the renderer
 */
export class JiraSnapshotService {
  constructor(
    private readonly repo: JiraSnapshotRepository,
    private readonly jiraRepo: JiraRepository,
    private readonly extensionService: ExtensionService,
    private readonly events: SnapshotEventSink,
  ) {}

  async getLatest(): Promise<GetLatestResponse> {
    return this.repo.getLatest();
  }

  async getMeta(): Promise<GetMetaResponse> {
    return this.repo.getMeta();
  }

  async sync(trigger: 'manual' | 'scheduled' = 'manual'): Promise<TriggerSyncResponse> {
    const startedAt = new Date().toISOString();
    this.events.emit({ phase: 'started' });
    try {
      const config = await this.resolveConfig();
      this.events.emit({ phase: 'fetching', message: 'Atlassian REST 호출 중…' });
      const { raw } = await this.jiraRepo.searchAssignedIssuesFull(config);
      LOG('fetched', raw.length, 'issue(s)');
      const issues = raw.map((r: AtlassianIssueRaw) =>
        normalizeAtlassianIssue(r, config.baseUrl),
      );
      const stored: StoredData = {
        syncedAt: startedAt,
        source: { baseUrl: config.baseUrl, projectKeys: config.projectKeys },
        issues,
        totalCount: issues.length,
      };
      this.events.emit({ phase: 'saving', count: issues.length });
      await this.repo.saveLatest(stored);
      await this.repo.appendRaw(stored);
      await this.repo.recordSync({
        at: startedAt,
        trigger,
        ok: true,
        count: issues.length,
      });
      // best-effort cleanup; don't fail the sync if it errors.
      void this.repo.cleanupRawOlderThan(RAW_RETENTION_DAYS).catch((err) => {
        LOG('cleanup error (ignored):', err instanceof Error ? err.message : err);
      });
      this.events.emit({ phase: 'completed', count: issues.length });
      return { ok: true, count: issues.length, syncedAt: startedAt };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      LOG('sync failed:', message);
      await this.repo.recordSync({
        at: startedAt,
        trigger,
        ok: false,
        count: 0,
        error: message,
      });
      this.events.emit({ phase: 'failed', message });
      throw err instanceof ApiError ? err : new ApiError('INTERNAL', message);
    }
  }

  private async resolveConfig(): Promise<JiraConfig> {
    const enabled = await this.extensionService.isEnabled(JIRA_EXTENSION_ID);
    if (!enabled) {
      throw new ApiError(
        'VALIDATION',
        'Jira 확장이 비활성화되어 있습니다. Extensions 패널에서 활성화하세요.',
      );
    }
    const settings = await this.extensionService.getSettings(JIRA_EXTENSION_ID);
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
