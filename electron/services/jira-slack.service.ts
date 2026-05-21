import { ApiError } from '../infra/error';
import {
  buildSlackStructuredReport,
  extractAssignees,
} from '../domain/jira-slack-report';
import { normalizeBaseUrl } from '../domain/jira';
import type {
  FindThreadMessageResponse,
  PreviewDailyReportResponse,
  SendDailyReportResponse,
  TestSlackConnectionResponse,
} from '../contracts/jira-slack';
import type { JiraSnapshotRepository } from '../repositories/jira-snapshot.repo';
import type { SlackRepository } from '../repositories/slack.repo';
import type { ExtensionService } from './extension.service';

const LOG = (...a: unknown[]) => console.log('[jira-slack.service]', ...a);

const JIRA_EXTENSION_ID = 'workos.jira';

type SlackConfig = {
  enabled: boolean;
  botToken: string;
  channelId: string;
  searchText: string;
  dailyReportTime: string;
  baseUrl: string;
};

/**
 * Use-case layer for the Jira ↔ Slack daily-share feature.
 *
 * Source of truth for credentials/config is the Jira extension's settings
 * (decrypted, safeStorage-backed). Snapshot data is read from the same
 * `latest.json` the dashboard uses — no live Jira call.
 */
export class JiraSlackService {
  constructor(
    private readonly snapshotRepo: JiraSnapshotRepository,
    private readonly slackRepo: SlackRepository,
    private readonly extensionService: ExtensionService,
  ) {}

  async resolveConfig(): Promise<SlackConfig> {
    const enabled = await this.extensionService.isEnabled(JIRA_EXTENSION_ID);
    if (!enabled) {
      throw new ApiError(
        'VALIDATION',
        'Jira 확장이 비활성화되어 있습니다.',
      );
    }
    const settings = await this.extensionService.getSettings(JIRA_EXTENSION_ID);
    const baseUrlRaw = typeof settings.baseUrl === 'string' ? settings.baseUrl : '';
    return {
      enabled: settings.slackEnabled === true,
      botToken: typeof settings.slackBotToken === 'string'
        ? settings.slackBotToken.trim()
        : '',
      channelId: typeof settings.slackChannelId === 'string'
        ? settings.slackChannelId.trim()
        : '',
      searchText: typeof settings.slackThreadSearchText === 'string'
        ? settings.slackThreadSearchText.trim()
        : '',
      dailyReportTime: typeof settings.slackDailyReportTime === 'string'
        ? settings.slackDailyReportTime.trim()
        : '',
      baseUrl: baseUrlRaw ? normalizeBaseUrl(baseUrlRaw) : '',
    };
  }

  async testConnection(
    override?: { botToken?: string; channelId?: string },
  ): Promise<TestSlackConnectionResponse> {
    try {
      const cfg = await this.resolveConfig();
      const token = (override?.botToken ?? cfg.botToken).trim();
      const channel = (override?.channelId ?? cfg.channelId).trim();
      if (!token) return { ok: false, error: 'Slack Bot Token이 비어 있습니다.' };
      if (!channel) return { ok: false, error: 'Channel ID가 비어 있습니다.' };
      return await this.slackRepo.testChannel(token, channel);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async findThreadMessage(
    override?: { botToken?: string; channelId?: string; searchText?: string },
  ): Promise<FindThreadMessageResponse> {
    try {
      const cfg = await this.resolveConfig();
      const token = (override?.botToken ?? cfg.botToken).trim();
      const channel = (override?.channelId ?? cfg.channelId).trim();
      const search = (override?.searchText ?? cfg.searchText).trim();
      if (!token || !channel || !search) {
        return {
          ok: false,
          error: 'Bot Token / Channel ID / 검색 텍스트가 모두 필요합니다.',
        };
      }
      const found = await this.slackRepo.findTodayMessage(token, channel, search);
      if (!found) return { ok: true, found: false };
      return { ok: true, found: true, ts: found.ts, text: found.text };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async previewDailyReport(): Promise<PreviewDailyReportResponse> {
    try {
      const cfg = await this.resolveConfig();
      const stored = await this.snapshotRepo.getLatest();
      if (!stored || stored.issues.length === 0) {
        return { ok: false, error: '스냅샷 데이터가 없습니다. 먼저 동기화하세요.' };
      }
      const baseUrl = cfg.baseUrl || stored.source.baseUrl;
      const assignees = extractAssignees(stored.issues);
      const entries = assignees
        .map((a) => ({
          assignee: a,
          message: buildSlackStructuredReport(a, stored.issues, baseUrl),
        }))
        .filter((e) => e.message.length > 0);
      return { ok: true, entries };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Find today's anchor message, then post one thread reply per assignee whose
   * in-progress task list is non-empty. Returns `sentCount`.
   */
  async sendDailyReport(): Promise<SendDailyReportResponse> {
    try {
      const cfg = await this.resolveConfig();
      if (!cfg.botToken || !cfg.channelId || !cfg.searchText) {
        return {
          ok: false,
          error:
            'Slack 설정이 완료되지 않았습니다 (Bot Token / Channel ID / 검색 텍스트 필요).',
        };
      }
      const stored = await this.snapshotRepo.getLatest();
      if (!stored || stored.issues.length === 0) {
        return { ok: false, error: '스냅샷 데이터가 없습니다. 먼저 동기화하세요.' };
      }

      const anchor = await this.slackRepo.findTodayMessage(
        cfg.botToken,
        cfg.channelId,
        cfg.searchText,
      );
      if (!anchor) {
        return {
          ok: false,
          error:
            '오늘 채널에서 검색 텍스트를 포함한 메시지를 찾지 못했습니다. 데일리 메시지가 올라온 뒤 다시 시도하세요.',
        };
      }

      const baseUrl = cfg.baseUrl || stored.source.baseUrl;
      const assignees = extractAssignees(stored.issues);
      let sentCount = 0;
      for (const assignee of assignees) {
        try {
          const message = buildSlackStructuredReport(
            assignee,
            stored.issues,
            baseUrl,
          );
          if (!message) continue;
          await this.slackRepo.postThreadReply(
            cfg.botToken,
            cfg.channelId,
            anchor.ts,
            message,
          );
          sentCount += 1;
          LOG('thread reply sent for', assignee);
        } catch (err) {
          LOG(
            'thread reply failed for',
            assignee,
            err instanceof Error ? err.message : err,
          );
        }
      }

      if (sentCount === 0) {
        return {
          ok: false,
          error: '진행중인 작업이 없어 전송한 메시지가 없습니다.',
        };
      }
      return { ok: true, sentCount, threadTs: anchor.ts };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
