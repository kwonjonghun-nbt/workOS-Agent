import type { LocalStoreRepository } from '../repositories/local-store.repo';
import type { LocalStoreSnapshot } from '../contracts/local-store';

/**
 * Serializes writes so that rapid setLocal/removeLocal calls from the renderer
 * cannot interleave and produce a torn JSON file on disk.
 */
export class LocalStoreService {
  private cache: LocalStoreSnapshot;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly repo: LocalStoreRepository) {
    this.cache = this.repo.load();
  }

  getAll(): LocalStoreSnapshot {
    return this.cache;
  }

  async set(key: string, value: string): Promise<void> {
    this.cache = { ...this.cache, [key]: value };
    await this.persist();
  }

  async remove(key: string): Promise<void> {
    if (!(key in this.cache)) return;
    const next = { ...this.cache };
    delete next[key];
    this.cache = next;
    await this.persist();
  }

  private persist(): Promise<void> {
    const next = this.writeQueue.then(() => this.repo.save(this.cache));
    this.writeQueue = next.catch(() => undefined);
    return next;
  }
}
