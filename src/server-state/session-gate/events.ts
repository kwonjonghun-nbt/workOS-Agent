import { sessionGateApi } from '../../api/session-gate';
import type { SessionGateCloseEvent, SessionGateOpenEvent } from '../../api/session-gate';

export const sessionGateEvents = {
  subscribeOpen: (listener: (event: SessionGateOpenEvent) => void) =>
    sessionGateApi.onOpen(listener),
  subscribeClose: (listener: (event: SessionGateCloseEvent) => void) =>
    sessionGateApi.onClose(listener),
};

export type { SessionGateCloseEvent, SessionGateOpenEvent };
