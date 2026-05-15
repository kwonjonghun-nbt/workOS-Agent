import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  createTerminalRequestSchema,
  disposeTerminalRequestSchema,
  listTerminalsRequestSchema,
  resizeTerminalRequestSchema,
  writeTerminalRequestSchema,
  type CreateTerminalResponse,
  type TerminalSummary,
} from '../contracts/terminal';
import type { TerminalService } from '../services/terminal.service';
import { toApiError } from '../infra/error';

export function registerTerminalHandlers(service: TerminalService): void {
  ipcMain.handle(CHANNELS.terminal.create, async (_e, raw): Promise<CreateTerminalResponse> => {
    try {
      const req = createTerminalRequestSchema.parse(raw);
      const sessionId = await service.create(req.workspaceId, { cols: req.cols, rows: req.rows });
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

  ipcMain.handle(CHANNELS.terminal.list, async (_e, raw): Promise<TerminalSummary[]> => {
    try {
      const { workspaceId } = listTerminalsRequestSchema.parse(raw);
      return service.list(workspaceId);
    } catch (err) {
      throw toApiError(err);
    }
  });
}
