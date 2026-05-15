import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Workspace } from '../domain/workspace';

export interface WorkspaceRepository {
  load(): Promise<Workspace[]>;
  save(list: Workspace[]): Promise<void>;
}

type WorkspaceJson = {
  id: string;
  name: string;
  rootPath: string;
  createdAt: number;
  lastOpenedAt: number;
};

type FileShape = {
  workspaces: WorkspaceJson[];
};

export class JsonWorkspaceRepository implements WorkspaceRepository {
  private readonly filePath: string;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'workspaces.json');
  }

  async load(): Promise<Workspace[]> {
    try {
      const buf = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(buf) as FileShape;
      if (!parsed || !Array.isArray(parsed.workspaces)) return [];
      return parsed.workspaces.map(
        (w) => new Workspace(w.id, w.name, w.rootPath, w.createdAt, w.lastOpenedAt),
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async save(list: Workspace[]): Promise<void> {
    const data: FileShape = {
      workspaces: list.map((w) => w.toJSON()),
    };
    const tmp = `${this.filePath}.tmp`;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmp, this.filePath);
  }
}
