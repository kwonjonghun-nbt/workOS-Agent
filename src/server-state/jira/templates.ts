import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { jiraTicketTemplateApi } from '../../api/jira/template';
import type { TemplateKind } from '../../api/jira/template';
import { jiraKeys } from './keys';

export const jiraTemplateKeys = {
  all: [...jiraKeys.all, 'templates'] as const,
  list: () => [...jiraTemplateKeys.all, 'list'] as const,
  detail: (kind: TemplateKind) => [...jiraTemplateKeys.all, 'detail', kind] as const,
};

export const jiraTemplateQueries = {
  list: () =>
    queryOptions({
      queryKey: jiraTemplateKeys.list(),
      queryFn: () => jiraTicketTemplateApi.list(),
      staleTime: 30_000,
    }),
  detail: (kind: TemplateKind) =>
    queryOptions({
      queryKey: jiraTemplateKeys.detail(kind),
      queryFn: () => jiraTicketTemplateApi.get({ kind }),
      staleTime: 30_000,
    }),
};

export const jiraTemplateMutations = {
  save: () =>
    mutationOptions({
      mutationKey: [...jiraTemplateKeys.all, 'save'] as const,
      mutationFn: jiraTicketTemplateApi.save,
    }),
  reset: () =>
    mutationOptions({
      mutationKey: [...jiraTemplateKeys.all, 'reset'] as const,
      mutationFn: jiraTicketTemplateApi.reset,
    }),
};
