import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  sessionGateResolveRequestSchema,
  type SessionGateResolveResponse,
} from '../contracts/session-gate';
import type { SessionGateService } from '../services/session-gate.service';
import { toApiError } from '../infra/error';

export function registerSessionGateHandlers(service: SessionGateService): void {
  ipcMain.handle(
    CHANNELS.sessionGate.resolve,
    async (_e, raw): Promise<SessionGateResolveResponse> => {
      try {
        const req = sessionGateResolveRequestSchema.parse(raw);
        return service.resolve(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
