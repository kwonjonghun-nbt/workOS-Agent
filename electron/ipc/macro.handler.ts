import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  deleteTileRequestSchema,
  pickPathRequestSchema,
  runTileRequestSchema,
  saveBoardRequestSchema,
  suggestTileRequestSchema,
  type PickPathResponse,
  type RunTileResponse,
  type SuggestTileResponse,
} from '../contracts/macro';
import type { MacroService } from '../services/macro.service';
import type { MacroState } from '../domain/macro';
import { toApiError } from '../infra/error';

export function registerMacroHandlers(service: MacroService): void {
  ipcMain.handle(CHANNELS.macro.getState, async (): Promise<MacroState> => {
    try {
      return await service.getState();
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.macro.saveBoard, async (_e, raw): Promise<MacroState> => {
    try {
      const req = saveBoardRequestSchema.parse(raw);
      return await service.saveBoard(req);
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.macro.deleteTile, async (_e, raw): Promise<MacroState> => {
    try {
      const req = deleteTileRequestSchema.parse(raw);
      return await service.deleteTile(req);
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.macro.suggestTile, async (_e, raw): Promise<SuggestTileResponse> => {
    try {
      const req = suggestTileRequestSchema.parse(raw);
      return await service.suggestTile(req);
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.macro.pickPath, async (_e, raw): Promise<PickPathResponse> => {
    try {
      const req = pickPathRequestSchema.parse(raw);
      return await service.pickPath(req);
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.macro.runTile, async (_e, raw): Promise<RunTileResponse> => {
    try {
      const req = runTileRequestSchema.parse(raw);
      return await service.runTile(req);
    } catch (err) {
      throw toApiError(err);
    }
  });
}
