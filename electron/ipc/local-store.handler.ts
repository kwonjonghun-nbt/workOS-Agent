import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  LocalStoreRemoveRequestSchema,
  LocalStoreSetRequestSchema,
} from '../contracts/local-store';
import type { LocalStoreService } from '../services/local-store.service';

export function registerLocalStoreHandlers(service: LocalStoreService): void {
  ipcMain.on(CHANNELS.localStore.getAllSync, (event) => {
    event.returnValue = service.getAll();
  });

  ipcMain.handle(CHANNELS.localStore.set, async (_e, payload: unknown) => {
    const req = LocalStoreSetRequestSchema.parse(payload);
    await service.set(req.key, req.value);
  });

  ipcMain.handle(CHANNELS.localStore.remove, async (_e, payload: unknown) => {
    const req = LocalStoreRemoveRequestSchema.parse(payload);
    await service.remove(req.key);
  });
}
