import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  createTerminalRequestSchema,
  disposeTerminalRequestSchema,
  resizeTerminalRequestSchema,
  writeTerminalRequestSchema,
  type CreateTerminalResponse,
  type TerminalDataEvent,
  type TerminalExitEvent,
} from '../contracts/terminal';
import { NodePtyRepository } from '../repositories/pty.repo';
import { TerminalService } from '../services/terminal.service';
import { eventBus } from '../infra/event-bus';
import { toApiError } from '../infra/error';

export function registerTerminalHandlers(): void {
  const repo = new NodePtyRepository();
  const service = new TerminalService(repo, {
    onData(sessionId, data) {
      const payload: TerminalDataEvent = { sessionId, data };
      eventBus.broadcast(CHANNELS.terminalEvents.data, payload);
    },
    onExit(sessionId, exitCode, signal) {
      const payload: TerminalExitEvent = { sessionId, exitCode, signal };
      eventBus.broadcast(CHANNELS.terminalEvents.exit, payload);
    },
  });

  ipcMain.handle(CHANNELS.terminal.create, async (_e, raw): Promise<CreateTerminalResponse> => {
    try {
      const req = createTerminalRequestSchema.parse(raw);
      const sessionId = service.create({ cols: req.cols, rows: req.rows });
      return { sessionId };
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.terminal.write, async (_e, raw): Promise<void> => {
    try {
      const { sessionId, data } = writeTerminalRequestSchema.parse(raw);
      service.write(sessionId, data);
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.terminal.resize, async (_e, raw): Promise<void> => {
    try {
      const { sessionId, cols, rows } = resizeTerminalRequestSchema.parse(raw);
      service.resize(sessionId, { cols, rows });
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.terminal.dispose, async (_e, raw): Promise<void> => {
    try {
      const { sessionId } = disposeTerminalRequestSchema.parse(raw);
      service.dispose(sessionId);
    } catch (err) {
      throw toApiError(err);
    }
  });
}
