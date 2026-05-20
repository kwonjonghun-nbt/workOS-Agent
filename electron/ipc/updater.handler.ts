import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  checkForUpdates,
  getUpdaterStatus,
  quitAndInstall,
} from '../infra/autoUpdater';

export function registerUpdaterHandlers(): void {
  ipcMain.handle(CHANNELS.updater.getStatus, async () => getUpdaterStatus());
  ipcMain.handle(CHANNELS.updater.check, async () => checkForUpdates());
  ipcMain.handle(CHANNELS.updater.quitAndInstall, async () => {
    quitAndInstall();
  });
}
