// Type-only mirror of electron/contracts/jira-reports.ts.

export type ReportMeta = {
  filename: string;
  size: number;
  modifiedAt: string;
};

export type GetReportRequest = { filename: string };
export type GetReportResponse = { filename: string; content: string };

export type SaveReportRequest = { filename: string; content: string };
export type DeleteReportRequest = { filename: string };

export type GenerateReportRequest = {
  startDate: string;
  endDate: string;
  model?: string;
};
export type GenerateReportResponse = { content: string };
