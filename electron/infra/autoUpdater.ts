import { app } from 'electron';
import electronUpdaterPkg from 'electron-updater';
import log from 'electron-log';
import { CHANNELS } from '../contracts/channels';
import type { UpdaterStatus } from '../contracts/updater';
import { eventBus } from './event-bus';

const { autoUpdater } = electronUpdaterPkg;

let status: UpdaterStatus = {
  state: 'idle',
  currentVersion: app.getVersion(),
  isPackaged: app.isPackaged,
};

function update(patch: Partial<UpdaterStatus>) {
  status = { ...status, ...patch };
  eventBus.broadcast(CHANNELS.updaterEvents.status, status);
}

export function getUpdaterStatus(): UpdaterStatus {
  return status;
}

export async function checkForUpdates(): Promise<UpdaterStatus> {
  if (!app.isPackaged) {
    update({ state: 'idle', error: 'dev mode: updates disabled' });
    return status;
  }
  update({ state: 'checking', error: undefined });
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn('[autoUpdater] check failed:', message);
    update({ state: 'error', error: message });
  }
  return status;
}

export function quitAndInstall(): void {
  if (status.state !== 'downloaded') return;
  autoUpdater.quitAndInstall();
}

export function initAutoUpdater() {
  if (!app.isPackaged) return;

  log.transports.file.level = 'info';
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    update({ state: 'checking', error: undefined });
  });
  autoUpdater.on('update-available', (info) => {
    update({
      state: 'available',
      newVersion: info?.version,
      releaseNotes: typeof info?.releaseNotes === 'string' ? info.releaseNotes : undefined,
    });
  });
  autoUpdater.on('update-not-available', () => {
    update({ state: 'not-available' });
  });
  autoUpdater.on('download-progress', (p) => {
    update({ state: 'downloading', progressPercent: Math.round(p?.percent ?? 0) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    update({ state: 'downloaded', newVersion: info?.version, progressPercent: 100 });
  });
  autoUpdater.on('error', (err) => {
    const message = err instanceof Error ? err.message : String(err);
    log.warn('[autoUpdater] error:', message);
    update({ state: 'error', error: message });
  });

  autoUpdater.checkForUpdates().catch((err) => {
    log.warn('[autoUpdater] initial check failed:', err);
  });
}
