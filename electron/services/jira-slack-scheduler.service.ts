import type { JiraSlackService } from './jira-slack.service';

const LOG = (...a: unknown[]) => console.log('[jira-slack-scheduler]', ...a);

/**
 * Polls every minute and fires `sendDailyReport()` once when the local clock
 * matches the user-configured `slackDailyReportTime` (HH:MM). Config is read
 * fresh each tick so the user can change the time without restarting the app.
 *
 * Failures are logged but never crash the tick loop. While a send is in
 * flight, concurrent ticks are skipped.
 */
export class JiraSlackSchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastFireKey: string | null = null;

  constructor(private readonly slack: JiraSlackService) {}

  start(): void {
    if (this.timer) return;
    LOG('scheduler start');
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    setTimeout(() => void this.tick(), 5_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    let cfg;
    try {
      cfg = await this.slack.resolveConfig();
    } catch {
      // Jira extension disabled — silently skip.
      return;
    }
    if (!cfg.enabled || !cfg.dailyReportTime) return;
    if (!/^\d{2}:\d{2}$/.test(cfg.dailyReportTime)) return;

    const now = new Date();
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (hhmm !== cfg.dailyReportTime) return;
    const key = `${now.toISOString().slice(0, 10)} ${hhmm}`;
    if (this.lastFireKey === key) return;
    this.lastFireKey = key;
    this.running = true;
    LOG('scheduled send firing at', key);
    try {
      const res = await this.slack.sendDailyReport();
      if (res.ok) LOG('scheduled send ok:', res.sentCount, 'reports');
      else LOG('scheduled send skipped/failed:', res.error);
    } catch (err) {
      LOG('scheduled send error:', err instanceof Error ? err.message : err);
    } finally {
      this.running = false;
    }
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
