import type {
  DeleteReportRequest,
  GenerateReportRequest,
  GenerateReportResponse,
  GetReportRequest,
  GetReportResponse,
  ReportMeta,
  SaveReportRequest,
} from './report-types';

function api() {
  return window.electronAPI.jiraReports;
}

export const jiraReportApi = {
  list: (): Promise<{ files: ReportMeta[] }> => api().list(),
  get: (req: GetReportRequest): Promise<GetReportResponse> => api().get(req),
  save: (req: SaveReportRequest): Promise<void> => api().save(req),
  delete: (req: DeleteReportRequest): Promise<void> => api().delete(req),
  generate: (req: GenerateReportRequest): Promise<GenerateReportResponse> =>
    api().generate(req),
};

export type {
  DeleteReportRequest,
  GenerateReportRequest,
  GenerateReportResponse,
  GetReportRequest,
  GetReportResponse,
  ReportMeta,
  SaveReportRequest,
} from './report-types';
