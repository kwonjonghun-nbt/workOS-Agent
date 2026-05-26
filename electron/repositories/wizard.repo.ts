import { promises as fs } from 'node:fs';
import path from 'node:path';
import { wizardSessionSchema, type WizardSession } from '../contracts/wizard';
import { ApiError } from '../infra/error';

/**
 * 워크스페이스당 1개의 위저드 세션 JSON.
 * 위치: <projectRoot>/.claude/workOS/wizard/session.json
 *
 * WorkOSRepository 와 같은 루트(`.claude/workOS/`) 하위에 위치시켜
 * 한 워크스페이스의 모든 workOS 상태가 한 곳에 모이도록 유지한다.
 */
export class WizardRepository {
  constructor(private readonly projectRoot: string) {
    if (!path.isAbsolute(projectRoot)) {
      throw new ApiError('VALIDATION', `projectRoot must be absolute: ${projectRoot}`);
    }
  }

  private file(): string {
    return path.join(this.projectRoot, '.claude', 'workOS', 'wizard', 'session.json');
  }

  async read(): Promise<WizardSession | null> {
    try {
      const buf = await fs.readFile(this.file(), 'utf-8');
      return wizardSessionSchema.parse(JSON.parse(buf));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      // 스키마 깨지면 무시하고 null — 새 세션이 만들어진다.
      return null;
    }
  }

  async write(session: WizardSession): Promise<void> {
    const file = this.file();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(session, null, 2), 'utf-8');
    await fs.rename(tmp, file);
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.file());
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}
