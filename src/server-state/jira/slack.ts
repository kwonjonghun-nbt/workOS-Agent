import { mutationOptions } from '@tanstack/react-query';
import { jiraSlackApi } from '../../api/jira/slack';
import { jiraKeys } from './keys';
import type {
  FindThreadMessageRequest,
  TestSlackConnectionRequest,
} from '../../api/jira/slack';

export const jiraSlackKeys = {
  all: [...jiraKeys.all, 'slack'] as const,
};

export const jiraSlackMutations = {
  testConnection: () =>
    mutationOptions({
      mutationKey: [...jiraSlackKeys.all, 'testConnection'] as const,
      mutationFn: (req: TestSlackConnectionRequest = {}) =>
        jiraSlackApi.testConnection(req),
    }),
  findThreadMessage: () =>
    mutationOptions({
      mutationKey: [...jiraSlackKeys.all, 'findThreadMessage'] as const,
      mutationFn: (req: FindThreadMessageRequest = {}) =>
        jiraSlackApi.findThreadMessage(req),
    }),
  sendDailyReport: () =>
    mutationOptions({
      mutationKey: [...jiraSlackKeys.all, 'sendDailyReport'] as const,
      mutationFn: () => jiraSlackApi.sendDailyReport(),
    }),
  previewDailyReport: () =>
    mutationOptions({
      mutationKey: [...jiraSlackKeys.all, 'previewDailyReport'] as const,
      mutationFn: () => jiraSlackApi.previewDailyReport(),
    }),
};

export type {
  FindThreadMessageResponse,
  PreviewDailyReportEntry,
  PreviewDailyReportResponse,
  SendDailyReportResponse,
  TestSlackConnectionResponse,
} from '../../api/jira/slack';
