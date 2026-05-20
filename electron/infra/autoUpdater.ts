import { app } from 'electron';
import electronUpdaterPkg from 'electron-updater';
import log from 'electron-log';

const { autoUpdater } = electronUpdaterPkg;

export function initAutoUpdater() {
  if (!app.isPackaged) return;

  log.transports.file.level = 'info';
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    log.warn('[autoUpdater] check failed:', err);
  });
}
