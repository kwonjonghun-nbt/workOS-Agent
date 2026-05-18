import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  createStepRequestSchema,
  createTaskItemRequestSchema,
  createTaskRequestSchema,
  createWorkflowRequestSchema,
  decomposeTaskRequestSchema,
  deleteStepRequestSchema,
  deleteTaskItemRequestSchema,
  deleteTaskRequestSchema,
  deleteWorkflowRequestSchema,
  executeTaskItemRequestSchema,
  gitCommitRequestSchema,
  gitDiffRequestSchema,
  gitFileDiffRequestSchema,
  gitStagePathsRequestSchema,
  gitStatusRequestSchema,
  gitUnstagePathsRequestSchema,
  importDecompositionRequestSchema,
  importWorkflowDraftRequestSchema,
  listByWorkspaceRequestSchema,
  requestAiDecomposeRequestSchema,
  requestAiWorkflowGenRequestSchema,
  seedPresetRequestSchema,
  updateStepRequestSchema,
  updateTaskItemRequestSchema,
  updateTaskRequestSchema,
  updateWorkflowRequestSchema,
} from '../contracts/workOS';
import { toApiError } from '../infra/error';
import type { WorkOSService } from '../services/workOS.service';

export function registerWorkOSHandlers(service: WorkOSService): void {
  const wrap =
    <T,>(fn: () => Promise<T>): Promise<T> =>
    fn().catch((err) => {
      throw toApiError(err);
    });

  ipcMain.handle(CHANNELS.workOS.listSteps, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = listByWorkspaceRequestSchema.parse(raw);
      return service.listSteps(workspaceId);
    }),
  );
  ipcMain.handle(CHANNELS.workOS.createStep, async (_e, raw) =>
    wrap(async () => service.createStep(createStepRequestSchema.parse(raw))),
  );
  ipcMain.handle(CHANNELS.workOS.updateStep, async (_e, raw) =>
    wrap(async () => service.updateStep(updateStepRequestSchema.parse(raw))),
  );
  ipcMain.handle(CHANNELS.workOS.deleteStep, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, id } = deleteStepRequestSchema.parse(raw);
      await service.deleteStep(workspaceId, id);
    }),
  );

  ipcMain.handle(CHANNELS.workOS.listWorkflows, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = listByWorkspaceRequestSchema.parse(raw);
      return service.listWorkflows(workspaceId);
    }),
  );
  ipcMain.handle(CHANNELS.workOS.createWorkflow, async (_e, raw) =>
    wrap(async () => service.createWorkflow(createWorkflowRequestSchema.parse(raw))),
  );
  ipcMain.handle(CHANNELS.workOS.updateWorkflow, async (_e, raw) =>
    wrap(async () => service.updateWorkflow(updateWorkflowRequestSchema.parse(raw))),
  );
  ipcMain.handle(CHANNELS.workOS.deleteWorkflow, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, id } = deleteWorkflowRequestSchema.parse(raw);
      await service.deleteWorkflow(workspaceId, id);
    }),
  );

  ipcMain.handle(CHANNELS.workOS.listTasks, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = listByWorkspaceRequestSchema.parse(raw);
      return service.listTasks(workspaceId);
    }),
  );
  ipcMain.handle(CHANNELS.workOS.createTask, async (_e, raw) =>
    wrap(async () => service.createTask(createTaskRequestSchema.parse(raw))),
  );
  ipcMain.handle(CHANNELS.workOS.updateTask, async (_e, raw) =>
    wrap(async () => service.updateTask(updateTaskRequestSchema.parse(raw))),
  );
  ipcMain.handle(CHANNELS.workOS.deleteTask, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, id } = deleteTaskRequestSchema.parse(raw);
      await service.deleteTask(workspaceId, id);
    }),
  );
  ipcMain.handle(CHANNELS.workOS.decomposeTask, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, taskId } = decomposeTaskRequestSchema.parse(raw);
      return service.decomposeTask(workspaceId, taskId);
    }),
  );

  ipcMain.handle(CHANNELS.workOS.listTaskItems, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = listByWorkspaceRequestSchema.parse(raw);
      return service.listTaskItems(workspaceId);
    }),
  );
  ipcMain.handle(CHANNELS.workOS.createTaskItem, async (_e, raw) =>
    wrap(async () => service.createTaskItem(createTaskItemRequestSchema.parse(raw))),
  );
  ipcMain.handle(CHANNELS.workOS.updateTaskItem, async (_e, raw) =>
    wrap(async () => service.updateTaskItem(updateTaskItemRequestSchema.parse(raw))),
  );
  ipcMain.handle(CHANNELS.workOS.deleteTaskItem, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, id } = deleteTaskItemRequestSchema.parse(raw);
      await service.deleteTaskItem(workspaceId, id);
    }),
  );
  ipcMain.handle(CHANNELS.workOS.executeTaskItem, async (_e, raw) =>
    wrap(async () => {
      const req = executeTaskItemRequestSchema.parse(raw);
      return service.executeTaskItem(req.workspaceId, req.taskItemId, req.cols, req.rows);
    }),
  );

  ipcMain.handle(CHANNELS.workOS.catalog, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = listByWorkspaceRequestSchema.parse(raw);
      return service.catalog(workspaceId);
    }),
  );

  ipcMain.handle(CHANNELS.workOS.gitDiff, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = gitDiffRequestSchema.parse(raw);
      return service.gitDiff(workspaceId);
    }),
  );
  ipcMain.handle(CHANNELS.workOS.gitCommit, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, message } = gitCommitRequestSchema.parse(raw);
      return service.gitCommit(workspaceId, message);
    }),
  );

  ipcMain.handle(CHANNELS.workOS.gitStatus, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = gitStatusRequestSchema.parse(raw);
      return service.gitStatus(workspaceId);
    }),
  );
  ipcMain.handle(CHANNELS.workOS.gitFileDiff, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, path, side } = gitFileDiffRequestSchema.parse(raw);
      return service.gitFileDiff(workspaceId, path, side);
    }),
  );
  ipcMain.handle(CHANNELS.workOS.gitStagePaths, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, paths } = gitStagePathsRequestSchema.parse(raw);
      await service.gitStagePaths(workspaceId, paths);
    }),
  );
  ipcMain.handle(CHANNELS.workOS.gitUnstagePaths, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, paths } = gitUnstagePathsRequestSchema.parse(raw);
      await service.gitUnstagePaths(workspaceId, paths);
    }),
  );

  ipcMain.handle(CHANNELS.workOS.seedPreset, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = seedPresetRequestSchema.parse(raw);
      return service.seedPresetWorkflow(workspaceId);
    }),
  );

  ipcMain.handle(CHANNELS.workOS.requestAiDecompose, async (_e, raw) =>
    wrap(async () => {
      const req = requestAiDecomposeRequestSchema.parse(raw);
      return service.requestAiDecomposition(req.workspaceId, req.taskId, req.cols, req.rows);
    }),
  );

  ipcMain.handle(CHANNELS.workOS.importDecomposition, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, taskId } = importDecompositionRequestSchema.parse(raw);
      return service.importDecomposition(workspaceId, taskId);
    }),
  );

  ipcMain.handle(CHANNELS.workOS.requestAiWorkflowGen, async (_e, raw) =>
    wrap(async () => {
      const req = requestAiWorkflowGenRequestSchema.parse(raw);
      return service.requestAiWorkflowGeneration(
        req.workspaceId,
        req.requirement,
        req.cols,
        req.rows,
      );
    }),
  );

  ipcMain.handle(CHANNELS.workOS.importWorkflowDraft, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, draftId } = importWorkflowDraftRequestSchema.parse(raw);
      return service.importWorkflowDraft(workspaceId, draftId);
    }),
  );
}
