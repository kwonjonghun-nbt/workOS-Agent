import type { JiraSnapshotService } from './jira-snapshot.service';

const LOG = (...a: unknown[]) => console.log('[jira-scheduler]', ...a);

const DEFAULT_TIMES = ['09:00', '13:00', '18:00'] as const;

/**
 * Lightweight in-process scheduler — wakes every minute and fires a snapshot
 * when the local clock matches one of {@link DEFAULT_TIMES}. We deliberately
 * avoid pulling in a cron dep for three fires/day.
 *
 * Concurrency safety: while a sync is in flight, ticks are ignored. Failures
 * are logged but never crash the loop.
 */
export class JiraSchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastFireKey: string | null = null; // 'YYYY-MM-DD HH:MM' of last fire

  constructor(private readonly snapshot: JiraSnapshotService) {}

  start(): void {
    if (this.timer) return;
    LOG('scheduler start; times=', DEFAULT_TIMES);
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    // First tick after a short delay so we don't pile up on app boot.
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
    const now = new Date();
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (!DEFAULT_TIMES.includes(hhmm as (typeof DEFAULT_TIMES)[number])) return;
    const key = `${now.toISOString().slice(0, 10)} ${hhmm}`;
    if (this.lastFireKey === key) return;
    this.lastFireKey = key;
    this.running = true;
    LOG('scheduled sync firing at', key);
    try {
      const res = await this.snapshot.sync('scheduled');
      LOG('scheduled sync ok:', res.count);
    } catch (err) {
      LOG('scheduled sync failed:', err instanceof Error ? err.message : err);
    } finally {
      this.running = false;
    }
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
