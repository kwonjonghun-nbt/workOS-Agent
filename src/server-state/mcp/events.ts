import type { QueryClient } from '@tanstack/react-query';
import { mcpApi } from '../../api/mcp';
import { workOSKeys } from '../workOS/keys';

type ProgressMap = Map<string, { message: string; at: number }>; // taskItemId → latest

const progressByWorkspace = new Map<string, ProgressMap>();
const listeners = new Set<(workspaceId: string) => void>();

export function latestProgress(workspaceId: string, taskItemId: string) {
  return progressByWorkspace.get(workspaceId)?.get(taskItemId);
}

export function subscribeProgress(listener: (workspaceId: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let bound = false;

export function bindMcpEvents(
  qc: QueryClient,
  onToast: (level: 'info' | 'warn' | 'error', message: string, workspaceId: string) => void,
): () => void {
  if (bound) return () => {};
  bound = true;
  const offProgress = mcpApi.onProgress((evt) => {
    let m = progressByWorkspace.get(evt.workspaceId);
    if (!m) {
      m = new Map();
      progressByWorkspace.set(evt.workspaceId, m);
    }
    m.set(evt.taskItemId, { message: evt.message, at: evt.at });
    for (const l of listeners) l(evt.workspaceId);
    qc.invalidateQueries({ queryKey: workOSKeys.taskItems(evt.workspaceId) });
  });
  const offToast = mcpApi.onToast((evt) => {
    onToast(evt.level, evt.message, evt.workspaceId);
  });
  return () => {
    offProgress();
    offToast();
    bound = false;
  };
}
