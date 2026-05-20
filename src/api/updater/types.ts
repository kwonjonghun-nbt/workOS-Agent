export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export type UpdaterStatus = {
  state: UpdateState;
  currentVersion: string;
  newVersion?: string;
  releaseNotes?: string;
  progressPercent?: number;
  error?: string;
  isPackaged: boolean;
};

export type UpdaterStatusEvent = UpdaterStatus;
