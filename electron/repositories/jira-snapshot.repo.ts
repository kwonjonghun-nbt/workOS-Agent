import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  MetaData,
  StoredData,
  SyncHistoryEntry,
} from '../contracts/jira-snapshot';

/**
 * File layout (under <userData>/jira-snapshot/):
 *
 *   latest.json                          ← current snapshot
 *   meta.json                            ← last sync time + history
 *   raw/<YYYY-MM-DD>/<HH-mm>.json        ← time-bucketed audit trail
 *
 * Writes are atomic (tmp + rename) so a partial flush never corrupts the
 * snapshot the renderer is reading.
 */
export interface JiraSnapshotRepository {
  getLatest(): Promise<StoredData | null>;
  saveLatest(data: StoredData): Promise<void>;
  appendRaw(data: StoredData): Promise<void>;
  getMeta(): Promise<MetaData>;
  recordSync(entry: SyncHistoryEntry): Promise<void>;
  cleanupRawOlderThan(days: number): Promise<void>;
}

export class JsonJiraSnapshotRepository implements JiraSnapshotRepository {
  private readonly rootDir: string;
  private readonly latestPath: string;
  private readonly metaPath: string;
  private readonly rawDir: string;

  constructor(userDataDir: string) {
    this.rootDir = path.join(userDataDir, 'jira-snapshot');
    this.latestPath = path.join(this.rootDir, 'latest.json');
    this.metaPath = path.join(this.rootDir, 'meta.json');
    this.rawDir = path.join(this.rootDir, 'raw');
  }

  async getLatest(): Promise<StoredData | null> {
    try {
      const buf = await fs.readFile(this.latestPath, 'utf-8');
      return JSON.parse(buf) as StoredData;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async saveLatest(data: StoredData): Promise<void> {
    await this.writeAtomic(this.latestPath, data);
  }

  async appendRaw(data: StoredData): Promise<void> {
    const d = new Date(data.syncedAt);
    if (Number.isNaN(d.getTime())) return;
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}-${pad(d.getMinutes())}`;
    const dir = path.join(this.rawDir, day);
    await fs.mkdir(dir, { recursive: true });
    await this.writeAtomic(path.join(dir, `${time}.json`), data);
  }

  async getMeta(): Promise<MetaData> {
    try {
      const buf = await fs.readFile(this.metaPath, 'utf-8');
      const parsed = JSON.parse(buf) as MetaData;
      return {
        lastSyncAt: parsed.lastSyncAt ?? null,
        history: Array.isArray(parsed.history) ? parsed.history : [],
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { lastSyncAt: null, history: [] };
      }
      throw err;
    }
  }

  async recordSync(entry: SyncHistoryEntry): Promise<void> {
    const meta = await this.getMeta();
    const next: MetaData = {
      lastSyncAt: entry.ok ? entry.at : meta.lastSyncAt,
      history: [entry, ...meta.history].slice(0, 50),
    };
    await this.writeAtomic(this.metaPath, next);
  }

  async cleanupRawOlderThan(days: number): Promise<void> {
    try {
      const entries = await fs.readdir(this.rawDir, { withFileTypes: true });
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      await Promise.all(
        entries
          .filter((e) => e.isDirectory())
          .map(async (e) => {
            const ts = Date.parse(e.name + 'T00:00:00');
            if (Number.isFinite(ts) && ts < cutoff) {
              await fs.rm(path.join(this.rawDir, e.name), {
                recursive: true,
                force: true,
              });
            }
          }),
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }

  private async writeAtomic(target: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf-8');
    await fs.rename(tmp, target);
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
