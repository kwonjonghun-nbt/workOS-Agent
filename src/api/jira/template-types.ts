// Mirror of electron/contracts/jira-ticket-template.ts — keep in sync.
// React 측은 electron/* 를 import 하지 않는다 (CLAUDE.md 경계 원칙).
export type TemplateKind = 'task' | 'epic';

export type TemplateSection = {
  key: string;
  title: string;
  description: string;
  required: boolean;
  hint: string;
};

export type TicketTemplate = {
  kind: TemplateKind;
  name: string;
  sections: TemplateSection[];
  updatedAt: string;
};

export type ListTicketTemplatesResponse = { templates: TicketTemplate[] };

export type GetTicketTemplateRequest = { kind: TemplateKind };

export type SaveTicketTemplateRequest = {
  kind: TemplateKind;
  name: string;
  sections: TemplateSection[];
};
