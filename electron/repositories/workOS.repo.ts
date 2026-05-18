import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Step, Task, TaskItem, Workflow } from '../contracts/workOS';
import {
  stepSchema,
  taskItemSchema,
  taskSchema,
  workflowSchema,
} from '../contracts/workOS';
import { ApiError } from '../infra/error';
import { isValidId } from '../domain/ids';

const ROOT_SEGMENT = path.join('.claude', 'workOS');
const DIRS = {
  steps: 'steps',
  workflows: 'workflows',
  tasks: 'tasks',
  taskItems: 'task-items',
  prompts: 'prompts',
} as const;

export class WorkOSRepository {
  constructor(private readonly projectRoot: string) {
    if (!path.isAbsolute(projectRoot)) {
      throw new ApiError('VALIDATION', `projectRoot must be absolute: ${projectRoot}`);
    }
  }

  private base(): string {
    return path.join(this.projectRoot, ROOT_SEGMENT);
  }
  dirOf(kind: keyof typeof DIRS): string {
    return path.join(this.base(), DIRS[kind]);
  }

  async ensure(): Promise<void> {
    for (const seg of Object.values(DIRS)) {
      const p = path.join(this.base(), seg);
      try {
        const st = await fs.stat(p);
        if (!st.isDirectory()) {
          throw new ApiError(
            'VALIDATION',
            `${p} is occupied by a non-directory; remove it manually`,
          );
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          await fs.mkdir(p, { recursive: true });
        } else {
          throw err;
        }
      }
    }
  }

  private fileOf(kind: keyof typeof DIRS, id: string): string {
    if (!isValidId(id)) throw new ApiError('VALIDATION', `invalid id: ${id}`);
    return path.join(this.dirOf(kind), `${id}.json`);
  }

  private async readJson<T>(file: string, parse: (raw: unknown) => T): Promise<T | null> {
    try {
      const buf = await fs.readFile(file, 'utf-8');
      return parse(JSON.parse(buf));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  private async writeJsonAtomic(file: string, data: unknown): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmp, file);
  }

  private async listAll<T>(
    kind: keyof typeof DIRS,
    parse: (raw: unknown) => T,
  ): Promise<T[]> {
    await this.ensure();
    const dir = this.dirOf(kind);
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const out: T[] = [];
    for (const n of names) {
      if (!n.endsWith('.json')) continue;
      const id = n.slice(0, -'.json'.length);
      if (!isValidId(id)) continue;
      const v = await this.readJson(path.join(dir, n), parse);
      if (v) out.push(v);
    }
    return out;
  }

  // Step
  listSteps = () => this.listAll('steps', (raw) => stepSchema.parse(raw));
  readStep = (id: string) =>
    this.readJson(this.fileOf('steps', id), (raw) => stepSchema.parse(raw));
  writeStep = async (v: Step) => {
    await this.ensure();
    await this.writeJsonAtomic(this.fileOf('steps', v.id), v);
  };
  deleteStep = async (id: string) => {
    try {
      await fs.unlink(this.fileOf('steps', id));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  };

  // Workflow
  listWorkflows = () => this.listAll('workflows', (raw) => workflowSchema.parse(raw));
  readWorkflow = (id: string) =>
    this.readJson(this.fileOf('workflows', id), (raw) => workflowSchema.parse(raw));
  writeWorkflow = async (v: Workflow) => {
    await this.ensure();
    await this.writeJsonAtomic(this.fileOf('workflows', v.id), v);
  };
  deleteWorkflow = async (id: string) => {
    try {
      await fs.unlink(this.fileOf('workflows', id));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  };

  // Task
  listTasks = () => this.listAll('tasks', (raw) => taskSchema.parse(raw));
  readTask = (id: string) =>
    this.readJson(this.fileOf('tasks', id), (raw) => taskSchema.parse(raw));
  writeTask = async (v: Task) => {
    await this.ensure();
    await this.writeJsonAtomic(this.fileOf('tasks', v.id), v);
  };
  deleteTask = async (id: string) => {
    try {
      await fs.unlink(this.fileOf('tasks', id));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  };

  // TaskItem
  listTaskItems = () => this.listAll('taskItems', (raw) => taskItemSchema.parse(raw));
  readTaskItem = (id: string) =>
    this.readJson(this.fileOf('taskItems', id), (raw) => taskItemSchema.parse(raw));
  writeTaskItem = async (v: TaskItem) => {
    await this.ensure();
    await this.writeJsonAtomic(this.fileOf('taskItems', v.id), v);
  };
  deleteTaskItem = async (id: string) => {
    try {
      await fs.unlink(this.fileOf('taskItems', id));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  };

  // Prompts (실행 시 임시 파일) — 평문 텍스트로 저장.
  async writePromptFile(taskItemId: string, content: string): Promise<string> {
    await this.ensure();
    if (!isValidId(taskItemId))
      throw new ApiError('VALIDATION', `invalid id: ${taskItemId}`);
    const ts = Date.now();
    const file = path.join(this.dirOf('prompts'), `${taskItemId}-${ts}.md`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, content, 'utf-8');
    await fs.rename(tmp, file);
    return file;
  }
}
