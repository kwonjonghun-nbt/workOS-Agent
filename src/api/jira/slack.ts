import type {
  FindThreadMessageRequest,
  FindThreadMessageResponse,
  PreviewDailyReportResponse,
  SendDailyReportResponse,
  TestSlackConnectionRequest,
  TestSlackConnectionResponse,
} from './slack-types';

function api() {
  return window.electronAPI.jiraSlack;
}

export const jiraSlackApi = {
  testConnection: (
    req: TestSlackConnectionRequest = {},
  ): Promise<TestSlackConnectionResponse> => api().testConnection(req),
  findThreadMessage: (
    req: FindThreadMessageRequest = {},
  ): Promise<FindThreadMessageResponse> => api().findThreadMessage(req),
  sendDailyReport: (): Promise<SendDailyReportResponse> =>
    api().sendDailyReport(),
  previewDailyReport: (): Promise<PreviewDailyReportResponse> =>
    api().previewDailyReport(),
};

export type {
  FindThreadMessageRequest,
  FindThreadMessageResponse,
  PreviewDailyReportEntry,
  PreviewDailyReportResponse,
  SendDailyReportResponse,
  TestSlackConnectionRequest,
  TestSlackConnectionResponse,
} from './slack-types';
