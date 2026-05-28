import { dialog, ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  addWorkspaceRequestSchema,
  removeWorkspaceRequestSchema,
  renameWorkspaceRequestSchema,
  setActiveWorkspaceRequestSchema,
  updateWorkspaceSettingsRequestSchema,
  type OpenDialogResponse,
  type TaskSource,
  type Workspace as WorkspaceDto,
  type WorkspaceKind,
} from '../contracts/workspace';
import type { WorkspaceService } from '../services/workspace.service';
import { toApiError } from '../infra/error';

const toDto = (w: {
  id: string;
  name: string;
  rootPath: string;
  createdAt: number;
  lastOpenedAt: number;
  kind: WorkspaceKind;
  taskSource: TaskSource;
}): WorkspaceDto => ({
  id: w.id,
  name: w.name,
  rootPath: w.rootPath,
  createdAt: w.createdAt,
  lastOpenedAt: w.lastOpenedAt,
  kind: w.kind,
  taskSource: w.taskSource,
});

export function registerWorkspaceHandlers(service: WorkspaceService): void {
  ipcMain.handle(CHANNELS.workspace.list, async (): Promise<WorkspaceDto[]> => {
    try {
      const list = await service.list();
      return list.map(toDto);
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.workspace.add, async (_e, raw): Promise<WorkspaceDto> => {
    try {
      const req = addWorkspaceRequestSchema.parse(raw);
      const ws = await service.add(req.path, req.name);
      return toDto(ws);
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.workspace.remove, async (_e, raw): Promise<void> => {
    try {
      const { id } = removeWorkspaceRequestSchema.parse(raw);
      await service.remove(id);
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.workspace.rename, async (_e, raw): Promise<WorkspaceDto> => {
    try {
      const { id, name } = renameWorkspaceRequestSchema.parse(raw);
      const ws = await service.rename(id, name);
      return toDto(ws);
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.workspace.setActive, async (_e, raw): Promise<void> => {
    try {
      const { id } = setActiveWorkspaceRequestSchema.parse(raw);
      await service.setActive(id);
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(
    CHANNELS.workspace.updateSettings,
    async (_e, raw): Promise<WorkspaceDto> => {
      try {
        const { id, patch } = updateWorkspaceSettingsRequestSchema.parse(raw);
        const ws = await service.updateSettings(id, patch);
        return toDto(ws);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(CHANNELS.workspace.openDialog, async (): Promise<OpenDialogResponse> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { path: null };
      }
      return { path: result.filePaths[0] };
    } catch (err) {
      throw toApiError(err);
    }
  });
}
