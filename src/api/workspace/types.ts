export type Workspace = {
  id: string;
  name: string;
  rootPath: string;
  createdAt: number;
  lastOpenedAt: number;
};

export type AddWorkspaceRequest = {
  path: string;
  name?: string;
};

export type RemoveWorkspaceRequest = {
  id: string;
};

export type RenameWorkspaceRequest = {
  id: string;
  name: string;
};

export type SetActiveWorkspaceRequest = {
  id: string;
};

export type OpenDialogResponse = {
  path: string | null;
};

export type WorkspaceChangedEvent = {
  workspaces: Workspace[];
};
