import { z } from 'zod';

export const UpdateStateSchema = z.enum([
  'idle',
  'checking',
  'available',
  'not-available',
  'downloading',
  'downloaded',
  'error',
]);
export type UpdateState = z.infer<typeof UpdateStateSchema>;

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

export const CheckForUpdatesRequestSchema = z.object({}).optional();
export type CheckForUpdatesRequest = z.infer<typeof CheckForUpdatesRequestSchema>;
