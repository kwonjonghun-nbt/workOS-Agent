// Type-only mirror of electron/contracts/jira-labels.ts.

export type LabelNote = {
  label: string;
  description: string;
  updatedAt: string;
};

export type SaveLabelNotesRequest = { notes: LabelNote[] };

export type SearchByLabelRequest = { projectKey: string; label: string };
export type SearchByLabelResponse = {
  issues: Array<{
    key: string;
    summary: string;
    labels: string[];
    status: string;
  }>;
};

export type BulkReplaceRequest = {
  issueKeys: string[];
  oldLabel: string;
  newLabel: string;
};
export type BulkReplaceResponse = {
  successKeys: string[];
  failed: { key: string; error: string }[];
};

export type UpdateIssueLabelsRequest = {
  issueKey: string;
  labels: string[];
};

export type SuggestLabelRequest = {
  issueKey: string;
  summary: string;
  description?: string;
  candidates: Array<{ label: string; description?: string }>;
  model?: string;
};
export type SuggestLabelResponse = { labels: string[]; reason: string };
