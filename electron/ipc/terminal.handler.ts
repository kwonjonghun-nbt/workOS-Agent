import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  createExtensionTerminalRequestSchema,
  createTerminalRequestSchema,
  disposeTerminalRequestSchema,
  listTerminalsRequestSchema,
  renameTerminalRequestSchema,
  resizeTerminalRequestSchema,
  writeTerminalRequestSchema,
  type CreateTerminalResponse,
  type TerminalSummary,
} from '../contracts/terminal';
import type { TerminalService } from '../services/terminal.service';
import type { WorkspaceService } from '../services/workspace.service';
import type { ExtensionService } from '../services/extension.service';
import { secretFieldKeys } from '../domain/extension';
import { toApiError, ApiError } from '../infra/error';
import { SYSTEM_DEFAULT_WORKSPACE_ID } from '../contracts/workspace';

export type ExtensionTerminalDeps = {
  workspace: WorkspaceService;
  extension: ExtensionService;
};

export function registerTerminalHandlers(
  service: TerminalService,
  extDeps: ExtensionTerminalDeps,
): void {
  ipcMain.handle(CHANNELS.terminal.create, async (_e, raw): Promise<CreateTerminalResponse> => {
    try {
      const req = createTerminalRequestSchema.parse(raw);
      // Only user-purpose terminals are accepted on the public create channel.
      // Extension terminals go through `terminal:createForExtension` so the
      // renderer cannot spoof an extension owner.
      if (req.purpose !== 'user') {
        throw new ApiError(
          'VALIDATION',
          'use terminal:createForExtension to create extension-owned terminals',
        );
      }
      const sessionId = await service.create(
        req.workspaceId,
        { cols: req.cols, rows: req.rows },
        { purpose: 'user' },
      );
      return { sessionId };
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(
    CHANNELS.terminal.createForExtension,
    async (_e, raw): Promise<CreateTerminalResponse> => {
      try {
        const req = createExtensionTerminalRequestSchema.parse(raw);
        const enabled = await extDeps.extension.isEnabled(req.extensionId);
        if (!enabled) {
          throw new ApiError(
            'VALIDATION',
            `extension is not enabled: ${req.extensionId}`,
          );
        }
        const cwd = await extDeps.workspace.resolveExtensionCwd(
          SYSTEM_DEFAULT_WORKSPACE_ID,
          req.extensionId,
        );
        const env = await buildExtensionEnv(extDeps.extension, req.extensionId);
        const sessionId = await service.create(
          SYSTEM_DEFAULT_WORKSPACE_ID,
          { cols: req.cols, rows: req.rows },
          {
            purpose: 'extension',
            ownerExtensionId: req.extensionId,
            cwdOverride: cwd,
            envOverride: env,
          },
        );
        return { sessionId };
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

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

  ipcMain.handle(CHANNELS.terminal.rename, async (_e, raw): Promise<void> => {
    try {
      const { sessionId, name } = renameTerminalRequestSchema.parse(raw);
      service.rename(sessionId, name);
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.terminal.list, async (_e, raw): Promise<TerminalSummary[]> => {
    try {
      const req = listTerminalsRequestSchema.parse(raw);
      return service.list(req.workspaceId, {
        purpose: req.purpose,
        ownerExtensionId: req.ownerExtensionId,
      });
    } catch (err) {
      throw toApiError(err);
    }
  });
}

/**
 * Build an env map from the extension's persisted settings. Settings declared
 * as `secret` get an `EXT_<UPPER_KEY>` env var so CLI subprocesses can read
 * tokens from the environment instead of having them written to files. Non-
 * secret string settings are also exposed under the same prefix for parity.
 */
async function buildExtensionEnv(
  extService: ExtensionService,
  extensionId: string,
): Promise<Record<string, string>> {
  const settings = await extService.getSettings(extensionId);
  const list = await extService.list();
  const item = list.find((x) => x.manifest.id === extensionId);
  const secrets = item ? secretFieldKeys(item.manifest) : new Set<string>();
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (typeof v !== 'string') continue;
    if (!v) continue;
    // Only expose secrets and non-secret strings; numbers/bools omitted.
    if (secrets.has(k) || typeof v === 'string') {
      env[`EXT_${k.toUpperCase()}`] = v;
    }
  }
  return env;
}
