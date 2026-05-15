import { mutationOptions } from '@tanstack/react-query';
import { workspaceApi } from '../../api/workspace';
import type {
  AddWorkspaceRequest,
  RemoveWorkspaceRequest,
  RenameWorkspaceRequest,
  SetActiveWorkspaceRequest,
  Workspace,
} from '../../api/workspace';
import type { OpenDialogResponse } from '../../api/workspace';

// 캐시 무효화는 메인이 broadcast 하는 `workspace:changed` 를 events.ts 에서 받아
// queryClient.setQueryData 로 직접 반영한다. 여기에는 onSuccess 무효화를 두지 않는다.

const addOptions = mutationOptions<Workspace, Error, AddWorkspaceRequest>({
  mutationFn: (req) => workspaceApi.add(req),
});

const removeOptions = mutationOptions<void, Error, RemoveWorkspaceRequest>({
  mutationFn: (req) => workspaceApi.remove(req),
});

const renameOptions = mutationOptions<Workspace, Error, RenameWorkspaceRequest>({
  mutationFn: (req) => workspaceApi.rename(req),
});

const setActiveOptions = mutationOptions<void, Error, SetActiveWorkspaceRequest>({
  mutationFn: (req) => workspaceApi.setActive(req),
});

const openDialogOptions = mutationOptions<OpenDialogResponse, Error, void>({
  mutationFn: () => workspaceApi.openDialog(),
});

export const workspaceMutations = {
  add: () => addOptions,
  remove: () => removeOptions,
  rename: () => renameOptions,
  setActive: () => setActiveOptions,
  openDialog: () => openDialogOptions,
};
