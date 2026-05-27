import { promises as fs, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { LocalStoreSnapshot } from '../contracts/local-store';

export interface LocalStoreRepository {
  load(): LocalStoreSnapshot;
  save(snapshot: LocalStoreSnapshot): Promise<void>;
}

export class JsonLocalStoreRepository implements LocalStoreRepository {
  private readonly filePath: string;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'local-store.json');
  }

  load(): LocalStoreSnapshot {
    try {
      if (!existsSync(this.filePath)) return {};
      const raw = readFileSync(this.filePath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      const out: LocalStoreSnapshot = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string') out[k] = v;
      }
      return out;
    } catch {
      return {};
    }
  }

  async save(snapshot: LocalStoreSnapshot): Promise<void> {
    const tmp = `${this.filePath}.tmp`;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2), 'utf-8');
    await fs.rename(tmp, this.filePath);
  }
}
