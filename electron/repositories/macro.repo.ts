import { promises as fs } from 'node:fs';
import path from 'node:path';
import { macroStateSchema } from '../contracts/macro';
import { defaultState, type MacroState } from '../domain/macro';

// Persists macro boards/buttons under <userData>/macro-buttons.json.
// Single global state (not per-workspace) — Stream Deck-style macros are a
// user-level concept rather than a workspace artifact.

export interface MacroRepository {
  load(): Promise<MacroState>;
  save(state: MacroState): Promise<void>;
}

export class JsonMacroRepository implements MacroRepository {
  private readonly filePath: string;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'macro-buttons.json');
  }

  async load(): Promise<MacroState> {
    try {
      const buf = await fs.readFile(this.filePath, 'utf-8');
      const parsed = macroStateSchema.safeParse(JSON.parse(buf));
      if (!parsed.success) return defaultState();
      return parsed.data;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return defaultState();
      throw err;
    }
  }

  async save(state: MacroState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tmp, this.filePath);
  }
}
