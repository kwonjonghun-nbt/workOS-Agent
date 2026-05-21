import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ApiError } from '../infra/error';
import type { ReportMeta } from '../contracts/jira-reports';

export interface ReportsRepository {
  list(): Promise<ReportMeta[]>;
  get(filename: string): Promise<string>;
  save(filename: string, content: string): Promise<void>;
  delete(filename: string): Promise<void>;
}

export class FsReportsRepository implements ReportsRepository {
  private readonly dir: string;

  constructor(userDataDir: string) {
    this.dir = path.join(userDataDir, 'jira-snapshot', 'reports');
  }

  async list(): Promise<ReportMeta[]> {
    try {
      const entries = await fs.readdir(this.dir, { withFileTypes: true });
      const out: ReportMeta[] = [];
      for (const e of entries) {
        if (!e.isFile() || !e.name.endsWith('.md')) continue;
        const stat = await fs.stat(path.join(this.dir, e.name));
        out.push({
          filename: e.name,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
      return out.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async get(filename: string): Promise<string> {
    const safe = this.safePath(filename);
    try {
      return await fs.readFile(safe, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ApiError('NOT_FOUND', `리포트를 찾을 수 없음: ${filename}`);
      }
      throw err;
    }
  }

  async save(filename: string, content: string): Promise<void> {
    const safe = this.safePath(filename);
    await fs.mkdir(path.dirname(safe), { recursive: true });
    const tmp = `${safe}.tmp`;
    await fs.writeFile(tmp, content, 'utf-8');
    await fs.rename(tmp, safe);
  }

  async delete(filename: string): Promise<void> {
    const safe = this.safePath(filename);
    try {
      await fs.unlink(safe);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }

  /** Defensive path resolution — reject any filename trying to escape the reports dir. */
  private safePath(filename: string): string {
    const resolved = path.resolve(this.dir, filename);
    if (!resolved.startsWith(this.dir + path.sep) && resolved !== this.dir) {
      throw new ApiError('VALIDATION', '리포트 파일명이 유효하지 않습니다.');
    }
    return resolved;
  }
}
