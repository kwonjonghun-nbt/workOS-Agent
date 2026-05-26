import type {
  GetTicketTemplateRequest,
  ListTicketTemplatesResponse,
  SaveTicketTemplateRequest,
  TicketTemplate,
} from './template-types';

function api() {
  return window.electronAPI.jiraTicketTemplates;
}

export const jiraTicketTemplateApi = {
  list: (): Promise<ListTicketTemplatesResponse> => api().list(),
  get: (req: GetTicketTemplateRequest): Promise<TicketTemplate> => api().get(req),
  save: (req: SaveTicketTemplateRequest): Promise<TicketTemplate> => api().save(req),
  reset: (req: GetTicketTemplateRequest): Promise<TicketTemplate> => api().reset(req),
};

export type {
  GetTicketTemplateRequest,
  ListTicketTemplatesResponse,
  SaveTicketTemplateRequest,
  TemplateKind,
  TemplateSection,
  TicketTemplate,
} from './template-types';
