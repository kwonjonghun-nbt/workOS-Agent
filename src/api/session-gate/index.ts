import type {
  SessionGateCloseEvent,
  SessionGateOpenEvent,
  SessionGateResolveRequest,
  SessionGateResolveResponse,
} from './types';

function api() {
  return window.electronAPI.sessionGate;
}

export const sessionGateApi = {
  resolve: (req: SessionGateResolveRequest): Promise<SessionGateResolveResponse> =>
    api().resolve(req),
  onOpen: (listener: (event: SessionGateOpenEvent) => void): (() => void) =>
    api().onOpen(listener),
  onClose: (listener: (event: SessionGateCloseEvent) => void): (() => void) =>
    api().onClose(listener),
};

export type {
  SessionGateChoice,
  SessionGateCloseEvent,
  SessionGateIssue,
  SessionGateOpenEvent,
  SessionGateResolveRequest,
  SessionGateResolveResponse,
} from './types';
