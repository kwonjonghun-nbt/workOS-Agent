import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ApiError } from '../infra/error';
import type {
  SlackThreadChannelCache,
  SlackThreadChannelMeta,
} from '../contracts/slack';

/**
 * Persists "topic thread" snapshots per Slack channel under
 * `<userData>/slack-threads/`. One index file lists the registered channels
 * for fast app-startup load; each channel keeps its full snapshot
 * (parents + replies) in `{channelId}.json`. Filenames are slugged so a
 * Slack id like "C01ABC" maps to a safe filename.
 *
 * All file writes use a `*.tmp + rename` pattern so a crash mid-write cannot
 * leave a half-baked snapshot on disk.
 */
export interface SlackThreadsRepository {
  listMeta(): Promise<SlackThreadChannelMeta[]>;
  load(channelId: string): Promise<SlackThreadChannelCache | null>;
  save(cache: SlackThreadChannelCache): Promise<void>;
  remove(channelId: string): Promise<void>;
}

type IndexFile = {
  channels: SlackThreadChannelMeta[];
};

export class FsSlackThreadsRepository implements SlackThreadsRepository {
  private readonly dir: string;
  private readonly indexPath: string;

  constructor(userDataDir: string) {
    this.dir = path.join(userDataDir, 'slack-threads');
    this.indexPath = path.join(this.dir, 'index.json');
  }

  async listMeta(): Promise<SlackThreadChannelMeta[]> {
    const idx = await this.readIndex();
    return [...idx.channels].sort((a, b) =>
      b.refreshedAt.localeCompare(a.refreshedAt),
    );
  }

  async load(channelId: string): Promise<SlackThreadChannelCache | null> {
    const fp = this.channelPath(channelId);
    try {
      const raw = await fs.readFile(fp, 'utf-8');
      const parsed = JSON.parse(raw) as SlackThreadChannelCache;
      if (!parsed || parsed.channelId !== channelId) return null;
      return parsed;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async save(cache: SlackThreadChannelCache): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const fp = this.channelPath(cache.channelId);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(cache, null, 2), 'utf-8');
    await fs.rename(tmp, fp);

    const idx = await this.readIndex();
    const next = idx.channels.filter((c) => c.channelId !== cache.channelId);
    next.push({
      channelId: cache.channelId,
      channelName: cache.channelName,
      days: cache.days,
      addedAt: cache.addedAt,
      refreshedAt: cache.refreshedAt,
      threadCount: cache.threads.length,
    });
    await this.writeIndex({ channels: next });
  }

  async remove(channelId: string): Promise<void> {
    const fp = this.channelPath(channelId);
    try {
      await fs.unlink(fp);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    const idx = await this.readIndex();
    const next = idx.channels.filter((c) => c.channelId !== channelId);
    if (next.length !== idx.channels.length) {
      await this.writeIndex({ channels: next });
    }
  }

  private channelPath(channelId: string): string {
    const safe = this.slug(channelId);
    const resolved = path.resolve(this.dir, `${safe}.json`);
    if (!resolved.startsWith(this.dir + path.sep)) {
      throw new ApiError('VALIDATION', 'channelId가 유효하지 않습니다.');
    }
    return resolved;
  }

  private slug(id: string): string {
    // Slack channel ids are [A-Z0-9]; defensive slugging guards future drift.
    return id.replace(/[^A-Za-z0-9_-]/g, '_');
  }

  private async readIndex(): Promise<IndexFile> {
    try {
      const raw = await fs.readFile(this.indexPath, 'utf-8');
      const parsed = JSON.parse(raw) as IndexFile;
      if (!parsed || !Array.isArray(parsed.channels)) return { channels: [] };
      return parsed;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { channels: [] };
      }
      throw err;
    }
  }

  private async writeIndex(idx: IndexFile): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const tmp = `${this.indexPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(idx, null, 2), 'utf-8');
    await fs.rename(tmp, this.indexPath);
  }
}
