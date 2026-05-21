import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { jiraReportApi } from '../../api/jira/report';
import { jiraKeys } from './keys';

export const jiraReportKeys = {
  all: [...jiraKeys.all, 'reports'] as const,
  list: () => [...jiraReportKeys.all, 'list'] as const,
  detail: (filename: string) => [...jiraReportKeys.all, 'detail', filename] as const,
};

export const jiraReportQueries = {
  list: () =>
    queryOptions({
      queryKey: jiraReportKeys.list(),
      queryFn: () => jiraReportApi.list(),
      staleTime: 10_000,
    }),
  detail: (filename: string) =>
    queryOptions({
      queryKey: jiraReportKeys.detail(filename),
      queryFn: () => jiraReportApi.get({ filename }),
      enabled: !!filename,
      staleTime: 60_000,
    }),
};

export const jiraReportMutations = {
  save: () =>
    mutationOptions({
      mutationKey: [...jiraReportKeys.all, 'save'] as const,
      mutationFn: jiraReportApi.save,
    }),
  delete: () =>
    mutationOptions({
      mutationKey: [...jiraReportKeys.all, 'delete'] as const,
      mutationFn: jiraReportApi.delete,
    }),
  generate: () =>
    mutationOptions({
      mutationKey: [...jiraReportKeys.all, 'generate'] as const,
      mutationFn: jiraReportApi.generate,
    }),
};

export type {
  GenerateReportResponse,
  GetReportResponse,
  ReportMeta,
} from '../../api/jira/report';
