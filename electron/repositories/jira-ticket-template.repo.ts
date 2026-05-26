import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  TemplateKind,
  TicketTemplate,
} from '../contracts/jira-ticket-template';
import { defaultTemplate, defaultTemplates } from '../domain/ticket-template';

export interface TicketTemplateRepository {
  list(): Promise<TicketTemplate[]>;
  get(kind: TemplateKind): Promise<TicketTemplate>;
  save(template: TicketTemplate): Promise<TicketTemplate>;
  reset(kind: TemplateKind): Promise<TicketTemplate>;
}

export class JsonTicketTemplateRepository implements TicketTemplateRepository {
  private readonly filePath: string;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, 'jira-snapshot', 'ticket-templates.json');
  }

  async list(): Promise<TicketTemplate[]> {
    const stored = await this.readAll();
    // 두 kind 모두 보장
    const map = new Map<TemplateKind, TicketTemplate>();
    for (const t of stored) map.set(t.kind, t);
    const now = new Date().toISOString();
    if (!map.has('task')) map.set('task', defaultTemplate('task', now));
    if (!map.has('epic')) map.set('epic', defaultTemplate('epic', now));
    return [map.get('task')!, map.get('epic')!];
  }

  async get(kind: TemplateKind): Promise<TicketTemplate> {
    const all = await this.list();
    return all.find((t) => t.kind === kind) ?? defaultTemplate(kind, new Date().toISOString());
  }

  async save(template: TicketTemplate): Promise<TicketTemplate> {
    const all = await this.readAll();
    const next = all.filter((t) => t.kind !== template.kind);
    next.push(template);
    await this.writeAll(next);
    return template;
  }

  async reset(kind: TemplateKind): Promise<TicketTemplate> {
    const all = await this.readAll();
    const next = all.filter((t) => t.kind !== kind);
    const fresh = defaultTemplate(kind, new Date().toISOString());
    next.push(fresh);
    await this.writeAll(next);
    return fresh;
  }

  private async readAll(): Promise<TicketTemplate[]> {
    try {
      const buf = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(buf) as { templates?: TicketTemplate[] };
      return Array.isArray(parsed?.templates) ? parsed.templates : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return defaultTemplates();
      }
      throw err;
    }
  }

  private async writeAll(templates: TicketTemplate[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ templates }, null, 2), 'utf-8');
    await fs.rename(tmp, this.filePath);
  }
}
