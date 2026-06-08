// IPC wrapper for user preferences (sync read + async writes).

export type SessionGateMode = 'always' | 'flag';

export type Preferences = {
  theme?: 'dark' | 'light';
  sessionGateHook?: boolean;
  sessionGateMode?: SessionGateMode;
};

function api() {
  return window.electronAPI.preferences;
}

export const preferencesApi = {
  getSync: (): Preferences => api().getSync(),
  setSessionGateHook: (enabled: boolean): Promise<void> =>
    api().setSessionGateHook({ enabled }),
  setSessionGateMode: (mode: SessionGateMode): Promise<void> =>
    api().setSessionGateMode({ mode }),
};
