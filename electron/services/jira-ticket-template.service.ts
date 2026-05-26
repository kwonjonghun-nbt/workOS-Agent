import type {
  GetTicketTemplateRequest,
  ListTicketTemplatesResponse,
  SaveTicketTemplateRequest,
  TicketTemplate,
} from '../contracts/jira-ticket-template';
import type { TicketTemplateRepository } from '../repositories/jira-ticket-template.repo';

export class JiraTicketTemplateService {
  constructor(private readonly repo: TicketTemplateRepository) {}

  async list(): Promise<ListTicketTemplatesResponse> {
    const templates = await this.repo.list();
    return { templates };
  }

  async get(req: GetTicketTemplateRequest): Promise<TicketTemplate> {
    return this.repo.get(req.kind);
  }

  async save(req: SaveTicketTemplateRequest): Promise<TicketTemplate> {
    return this.repo.save({
      kind: req.kind,
      name: req.name,
      sections: req.sections,
      updatedAt: new Date().toISOString(),
    });
  }

  async reset(req: GetTicketTemplateRequest): Promise<TicketTemplate> {
    return this.repo.reset(req.kind);
  }
}
