import { promises as fs, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PreferencesSchema, type Preferences } from '../contracts/preferences';

export interface PreferencesRepository {
  load(): Preferences;
  save(prefs: Preferences): Promise<void>;
}

export class JsonPreferencesRepository implements PreferencesRepository {
  private readonly filePath: string;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'preferences.json');
  }

  load(): Preferences {
    try {
      if (!existsSync(this.filePath)) return {};
      const raw = readFileSync(this.filePath, 'utf-8');
      const parsed = PreferencesSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : {};
    } catch {
      return {};
    }
  }

  async save(prefs: Preferences): Promise<void> {
    const tmp = `${this.filePath}.tmp`;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(prefs, null, 2), 'utf-8');
    await fs.rename(tmp, this.filePath);
  }
}
