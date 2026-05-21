import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { LabelNote } from '../contracts/jira-labels';

export interface LabelNotesRepository {
  load(): Promise<LabelNote[]>;
  save(notes: LabelNote[]): Promise<void>;
}

export class JsonLabelNotesRepository implements LabelNotesRepository {
  private readonly filePath: string;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'jira-snapshot', 'label-notes.json');
  }

  async load(): Promise<LabelNote[]> {
    try {
      const buf = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(buf) as { notes?: LabelNote[] };
      return Array.isArray(parsed?.notes) ? parsed.notes : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async save(notes: LabelNote[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ notes }, null, 2), 'utf-8');
    await fs.rename(tmp, this.filePath);
  }
}
