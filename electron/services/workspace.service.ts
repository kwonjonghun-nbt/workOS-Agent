import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Workspace } from '../domain/workspace';
import type { WorkspaceRepository } from '../repositories/workspace.repo';
import { ApiError } from '../infra/error';

export interface CascadeDisposer {
  disposeByWorkspace(workspaceId: string): void;
}

export class WorkspaceService {
  private cache: Workspace[] | null = null;

  constructor(
    private readonly repo: WorkspaceRepository,
    private readonly cascade: CascadeDisposer,
    private readonly onChanged: (list: Workspace[]) => void,
  ) {}

  private async ensureLoaded(): Promise<Workspace[]> {
    if (!this.cache) {
      this.cache = await this.repo.load();
    }
    return this.cache;
  }

  private async persist(): Promise<void> {
    if (!this.cache) return;
    await this.repo.save(this.cache);
    this.onChanged(this.cache.slice());
  }

  async list(): Promise<Workspace[]> {
    const list = await this.ensureLoaded();
    return list.slice();
  }

  async add(rawPath: string, name?: string): Promise<Workspace> {
    const abs = path.resolve(rawPath);
    let stat;
    try {
      stat = await fs.stat(abs);
    } catch {
      throw new ApiError('VALIDATION', `path does not exist: ${abs}`);
    }
    if (!stat.isDirectory()) {
      throw new ApiError('VALIDATION', `path is not a directory: ${abs}`);
    }

    const list = await this.ensureLoaded();
    const existing = list.find((w) => w.rootPath === abs);
    if (existing) {
      existing.touch(Date.now());
      await this.persist();
      return existing;
    }

    const ws = new Workspace(
      randomUUID(),
      (name?.trim() || path.basename(abs)) ?? 'workspace',
      abs,
      Date.now(),
      Date.now(),
    );
    list.push(ws);
    await this.persist();
    return ws;
  }

  async remove(id: string): Promise<void> {
    const list = await this.ensureLoaded();
    const idx = list.findIndex((w) => w.id === id);
    if (idx === -1) throw new ApiError('NOT_FOUND', `workspace not found: ${id}`);
    this.cascade.disposeByWorkspace(id);
    list.splice(idx, 1);
    await this.persist();
  }

  async rename(id: string, name: string): Promise<Workspace> {
    const list = await this.ensureLoaded();
    const ws = list.find((w) => w.id === id);
    if (!ws) throw new ApiError('NOT_FOUND', `workspace not found: ${id}`);
    ws.rename(name);
    await this.persist();
    return ws;
  }

  async setActive(id: string): Promise<void> {
    const list = await this.ensureLoaded();
    const ws = list.find((w) => w.id === id);
    if (!ws) throw new ApiError('NOT_FOUND', `workspace not found: ${id}`);
    ws.touch(Date.now());
    await this.persist();
  }

  async resolveCwd(workspaceId: string): Promise<string> {
    const list = await this.ensureLoaded();
    const ws = list.find((w) => w.id === workspaceId);
    if (!ws) throw new ApiError('NOT_FOUND', `workspace not found: ${workspaceId}`);
    return ws.rootPath;
  }
}
