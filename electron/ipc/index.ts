import { app } from 'electron';
import { CHANNELS } from '../contracts/channels';
import type { TerminalDataEvent, TerminalExitEvent } from '../contracts/terminal';
import type { Workspace } from '../domain/workspace';
import { NodePtyRepository } from '../repositories/pty.repo';
import { JsonWorkspaceRepository } from '../repositories/workspace.repo';
import { TerminalService } from '../services/terminal.service';
import { WorkspaceService } from '../services/workspace.service';
import { eventBus } from '../infra/event-bus';
import { registerTerminalHandlers } from './terminal.handler';
import { registerWorkspaceHandlers } from './workspace.handler';

export type Container = {
  workspaceService: WorkspaceService;
  terminalService: TerminalService;
};

export function registerIpcHandlers(): Container {
  const ptyRepo = new NodePtyRepository();
  const workspaceRepo = new JsonWorkspaceRepository(app.getPath('userData'));

  // 두 서비스가 서로 참조하므로 lazy holder 로 순환을 끊는다.
  let terminalServiceHolder: TerminalService | null = null;

  const workspaceService = new WorkspaceService(
    workspaceRepo,
    {
      disposeByWorkspace(id) {
        terminalServiceHolder?.disposeByWorkspace(id);
      },
    },
    (list: Workspace[]) => {
      eventBus.broadcast(CHANNELS.workspaceEvents.changed, { workspaces: list });
    },
  );

  const terminalService = new TerminalService(
    ptyRepo,
    {
      onData(sessionId, data) {
        const payload: TerminalDataEvent = { sessionId, data };
        eventBus.broadcast(CHANNELS.terminalEvents.data, payload);
      },
      onExit(sessionId, workspaceId, exitCode, signal) {
        const payload: TerminalExitEvent = { sessionId, workspaceId, exitCode, signal };
        eventBus.broadcast(CHANNELS.terminalEvents.exit, payload);
      },
    },
    { resolveCwd: (id) => workspaceService.resolveCwd(id) },
  );
  terminalServiceHolder = terminalService;

  registerWorkspaceHandlers(workspaceService);
  registerTerminalHandlers(terminalService);

  return { workspaceService, terminalService };
}
