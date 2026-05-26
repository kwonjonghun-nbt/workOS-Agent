import { z } from 'zod';

/**
 * Ticket template — 지라 티켓/에픽 본문이 어떤 섹션으로 구성되어야 하는지에
 * 대한 사용자 정의. kind 에 따라 두 종류가 별개로 관리된다.
 * - task: 일반 티켓(Task, Story, Bug 등 에픽이 아닌 모든 것)
 * - epic: 에픽 전용. 위키 문서 링크/디자인 링크 같은 컨텍스트 섹션이 기본 포함.
 */
export const templateKindSchema = z.enum(['task', 'epic']);
export type TemplateKind = z.infer<typeof templateKindSchema>;

export const templateSectionSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  required: z.boolean().default(false),
  hint: z.string().default(''),
});
export type TemplateSection = z.infer<typeof templateSectionSchema>;

export const ticketTemplateSchema = z.object({
  kind: templateKindSchema,
  name: z.string().min(1),
  sections: z.array(templateSectionSchema).min(1),
  updatedAt: z.string(),
});
export type TicketTemplate = z.infer<typeof ticketTemplateSchema>;

export const saveTicketTemplateRequestSchema = z.object({
  kind: templateKindSchema,
  name: z.string().min(1),
  sections: z.array(templateSectionSchema).min(1),
});
export type SaveTicketTemplateRequest = z.infer<typeof saveTicketTemplateRequestSchema>;

export const getTicketTemplateRequestSchema = z.object({
  kind: templateKindSchema,
});
export type GetTicketTemplateRequest = z.infer<typeof getTicketTemplateRequestSchema>;

export type ListTicketTemplatesResponse = { templates: TicketTemplate[] };
