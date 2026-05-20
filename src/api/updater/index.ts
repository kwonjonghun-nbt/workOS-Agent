import type { UpdaterApi } from '../electronAPI';
import type { UpdaterStatus, UpdaterStatusEvent } from './types';

function api(): UpdaterApi {
  return window.electronAPI.updater;
}

export const updaterApi = {
  getStatus: () => api().getStatus(),
  check: () => api().check(),
  quitAndInstall: () => api().quitAndInstall(),
  onStatus: (listener: (event: UpdaterStatusEvent) => void) => api().onStatus(listener),
};

export type { UpdaterStatus, UpdaterStatusEvent };
