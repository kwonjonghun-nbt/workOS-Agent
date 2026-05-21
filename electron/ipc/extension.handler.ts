import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  setEnabledRequestSchema,
  updateSettingsRequestSchema,
  type ExtensionListItem,
} from '../contracts/extension';
import type { ExtensionService } from '../services/extension.service';
import { toApiError } from '../infra/error';

export function registerExtensionHandlers(service: ExtensionService): void {
  ipcMain.handle(CHANNELS.extension.list, async (): Promise<ExtensionListItem[]> => {
    try {
      return await service.list();
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(
    CHANNELS.extension.setEnabled,
    async (_e, raw): Promise<ExtensionListItem> => {
      try {
        const { id, enabled } = setEnabledRequestSchema.parse(raw);
        return await service.setEnabled(id, enabled);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.extension.updateSettings,
    async (_e, raw): Promise<ExtensionListItem> => {
      try {
        const { id, settings } = updateSettingsRequestSchema.parse(raw);
        return await service.updateSettings(id, settings);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
