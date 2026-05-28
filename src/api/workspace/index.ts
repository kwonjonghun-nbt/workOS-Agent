import type {
  AddWorkspaceRequest,
  OpenDialogResponse,
  RemoveWorkspaceRequest,
  RenameWorkspaceRequest,
  SetActiveWorkspaceRequest,
  TaskSource,
  UpdateWorkspaceSettingsRequest,
  Workspace,
  WorkspaceChangedEvent,
} from './types';
import type { WorkspaceApi } from '../electronAPI';

function api(): WorkspaceApi {
  return window.electronAPI.workspace;
}

export const workspaceApi = {
  list: () => api().list(),
  add: (req: AddWorkspaceRequest) => api().add(req),
  remove: (req: RemoveWorkspaceRequest) => api().remove(req),
  rename: (req: RenameWorkspaceRequest) => api().rename(req),
  setActive: (req: SetActiveWorkspaceRequest) => api().setActive(req),
  updateSettings: (req: UpdateWorkspaceSettingsRequest) => api().updateSettings(req),
  openDialog: () => api().openDialog(),
  onChanged: (listener: (event: WorkspaceChangedEvent) => void) => api().onChanged(listener),
};

export type {
  Workspace,
  TaskSource,
  AddWorkspaceRequest,
  RemoveWorkspaceRequest,
  RenameWorkspaceRequest,
  SetActiveWorkspaceRequest,
  UpdateWorkspaceSettingsRequest,
  OpenDialogResponse,
  WorkspaceChangedEvent,
};
