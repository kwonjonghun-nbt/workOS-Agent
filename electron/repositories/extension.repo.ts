import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/**
 * Per-user extension state — enabled flag and settings. Extension identity
 * lives in the bundled catalog, so we only persist user-mutable bits keyed by
 * extension id.
 *
 *   <userData>/extensions-state.json
 *     { "states": { "workos.sample-hello": { "enabled": true, "settings": { ... } } } }
 */

const settingsValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const extensionStateSchema = z.object({
  enabled: z.boolean(),
  settings: z.record(z.string(), settingsValueSchema),
});

const fileShapeSchema = z.object({
  states: z.record(z.string(), extensionStateSchema),
});

export type ExtensionState = z.infer<typeof extensionStateSchema>;

export interface ExtensionStateRepository {
  load(): Promise<Record<string, ExtensionState>>;
  save(states: Record<string, ExtensionState>): Promise<void>;
}

export class JsonExtensionStateRepository implements ExtensionStateRepository {
  private readonly filePath: string;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'extensions-state.json');
  }

  async load(): Promise<Record<string, ExtensionState>> {
    try {
      const buf = await fs.readFile(this.filePath, 'utf-8');
      const parsed = fileShapeSchema.safeParse(JSON.parse(buf));
      if (!parsed.success) return {};
      return parsed.data.states;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw err;
    }
  }

  async save(states: Record<string, ExtensionState>): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ states }, null, 2), 'utf-8');
    await fs.rename(tmp, this.filePath);
  }
}
