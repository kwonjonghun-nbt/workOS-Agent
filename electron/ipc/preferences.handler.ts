import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  SetSessionGateHookRequestSchema,
  SetSessionGateModeRequestSchema,
  SetThemeRequestSchema,
} from '../contracts/preferences';
import type { PreferencesService } from '../services/preferences.service';

export function registerPreferencesHandlers(service: PreferencesService): void {
  ipcMain.on(CHANNELS.preferences.getSync, (event) => {
    event.returnValue = service.getAll();
  });

  ipcMain.handle(CHANNELS.preferences.setTheme, async (_e, payload: unknown) => {
    const req = SetThemeRequestSchema.parse(payload);
    await service.setTheme(req.theme);
  });

  ipcMain.handle(CHANNELS.preferences.setSessionGateHook, async (_e, payload: unknown) => {
    const req = SetSessionGateHookRequestSchema.parse(payload);
    await service.setSessionGateHook(req.enabled);
  });

  ipcMain.handle(CHANNELS.preferences.setSessionGateMode, async (_e, payload: unknown) => {
    const req = SetSessionGateModeRequestSchema.parse(payload);
    await service.setSessionGateMode(req.mode);
  });
}
