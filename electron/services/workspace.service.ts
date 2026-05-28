import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Workspace } from '../domain/workspace';
import type { WorkspaceRepository } from '../repositories/workspace.repo';
import { ApiError } from '../infra/error';
import {
  SYSTEM_DEFAULT_WORKSPACE_ID,
  type TaskSource,
} from '../contracts/workspace';

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
    // Only user workspaces are advertised to the renderer. System workspaces
    // are an implementation detail of the extension runtime.
    this.onChanged(this.cache.filter((w) => w.kind === 'user').slice());
  }

  /** Renderer-visible list: user workspaces only. */
  async list(): Promise<Workspace[]> {
    const list = await this.ensureLoaded();
    return list.filter((w) => w.kind === 'user').slice();
  }

  /** Internal: includes system workspaces. */
  async listAll(): Promise<Workspace[]> {
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
    const existing = list.find((w) => w.rootPath === abs && w.kind === 'user');
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
      'user',
    );
    list.push(ws);
    await this.persist();
    return ws;
  }

  async remove(id: string): Promise<void> {
    const list = await this.ensureLoaded();
    const idx = list.findIndex((w) => w.id === id);
    if (idx === -1) throw new ApiError('NOT_FOUND', `workspace not found: ${id}`);
    if (list[idx].kind === 'system') {
      throw new ApiError('VALIDATION', 'system workspace cannot be removed');
    }
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

  async read(id: string): Promise<Workspace | null> {
    const list = await this.ensureLoaded();
    return list.find((w) => w.id === id) ?? null;
  }

  async updateSettings(
    id: string,
    patch: { taskSource?: TaskSource; jiraDefaultIssueType?: string },
  ): Promise<Workspace> {
    const list = await this.ensureLoaded();
    const ws = list.find((w) => w.id === id);
    if (!ws) throw new ApiError('NOT_FOUND', `workspace not found: ${id}`);
    ws.updateSettings(patch);
    await this.persist();
    return ws;
  }

  async setActive(id: string): Promise<void> {
    const list = await this.ensureLoaded();
    const ws = list.find((w) => w.id === id);
    if (!ws) throw new ApiError('NOT_FOUND', `workspace not found: ${id}`);
    if (ws.kind === 'system') {
      throw new ApiError('VALIDATION', 'system workspace cannot be set active');
    }
    ws.touch(Date.now());
    await this.persist();
  }

  async resolveCwd(workspaceId: string): Promise<string> {
    const list = await this.ensureLoaded();
    const ws = list.find((w) => w.id === workspaceId);
    if (!ws) throw new ApiError('NOT_FOUND', `workspace not found: ${workspaceId}`);
    return ws.rootPath;
  }

  /**
   * Bootstraps a singleton system-default workspace rooted at the given path.
   * Seeds an empty `.claude/{agents,skills}` template the first time so that
   * extension CLI runs (claude code) see a non-empty catalog directory.
   *
   * Returns the workspace id (always SYSTEM_DEFAULT_WORKSPACE_ID).
   */
  async ensureSystemDefault(rootPath: string): Promise<string> {
    const abs = path.resolve(rootPath);
    await fs.mkdir(abs, { recursive: true });
    await fs.mkdir(path.join(abs, '.claude', 'agents'), { recursive: true });
    await fs.mkdir(path.join(abs, '.claude', 'skills'), { recursive: true });

    const list = await this.ensureLoaded();
    const existing = list.find((w) => w.id === SYSTEM_DEFAULT_WORKSPACE_ID);
    if (existing) {
      existing.touch(Date.now());
      // No persist broadcast since system workspaces are hidden anyway.
      return existing.id;
    }
    const ws = new Workspace(
      SYSTEM_DEFAULT_WORKSPACE_ID,
      'System Default',
      abs,
      Date.now(),
      Date.now(),
      'system',
    );
    list.push(ws);
    await this.repo.save(list);
    return ws.id;
  }

  /**
   * Returns an extension-scoped sub-directory under a workspace's rootPath.
   * Used so each extension gets its own cwd (and thus its own `.claude` /
   * `.mcp-session.json` namespace), avoiding cross-extension race conditions
   * on shared session/state files.
   */
  async resolveExtensionCwd(workspaceId: string, extensionId: string): Promise<string> {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(extensionId)) {
      throw new ApiError('VALIDATION', `invalid extensionId: ${extensionId}`);
    }
    const root = await this.resolveCwd(workspaceId);
    const sub = path.join(root, 'extensions', extensionId);
    await fs.mkdir(path.join(sub, '.claude', 'agents'), { recursive: true });
    await fs.mkdir(path.join(sub, '.claude', 'skills'), { recursive: true });
    return sub;
  }
}
