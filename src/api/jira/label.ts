import type {
  BulkReplaceRequest,
  BulkReplaceResponse,
  LabelNote,
  SaveLabelNotesRequest,
  SearchByLabelRequest,
  SearchByLabelResponse,
  SuggestLabelRequest,
  SuggestLabelResponse,
  UpdateIssueLabelsRequest,
} from './label-types';

function api() {
  return window.electronAPI.jiraLabels;
}

export const jiraLabelApi = {
  getNotes: (): Promise<LabelNote[]> => api().getNotes(),
  saveNotes: (req: SaveLabelNotesRequest): Promise<LabelNote[]> =>
    api().saveNotes(req),
  searchByLabel: (req: SearchByLabelRequest): Promise<SearchByLabelResponse> =>
    api().searchByLabel(req),
  bulkReplace: (req: BulkReplaceRequest): Promise<BulkReplaceResponse> =>
    api().bulkReplace(req),
  updateIssueLabels: (req: UpdateIssueLabelsRequest): Promise<void> =>
    api().updateIssueLabels(req),
  suggest: (req: SuggestLabelRequest): Promise<SuggestLabelResponse> =>
    api().suggest(req),
};

export type {
  BulkReplaceRequest,
  BulkReplaceResponse,
  LabelNote,
  SaveLabelNotesRequest,
  SearchByLabelRequest,
  SearchByLabelResponse,
  SuggestLabelRequest,
  SuggestLabelResponse,
  UpdateIssueLabelsRequest,
} from './label-types';
