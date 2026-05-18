import { mutationOptions } from '@tanstack/react-query';
import { workOSApi } from '../../api/workOS';
import type {
  CreateStepRequest,
  CreateTaskItemRequest,
  CreateTaskRequest,
  CreateWorkflowRequest,
  DecomposeTaskRequest,
  DeleteStepRequest,
  DeleteTaskItemRequest,
  DeleteTaskRequest,
  DeleteWorkflowRequest,
  ExecuteTaskItemRequest,
  ExecuteTaskItemResponse,
  GitCommitRequest,
  GitCommitResponse,
  GitStagePathsRequest,
  GitUnstagePathsRequest,
  Step,
  Task,
  TaskItem,
  UpdateStepRequest,
  UpdateTaskItemRequest,
  UpdateTaskRequest,
  UpdateWorkflowRequest,
  Workflow,
} from '../../api/workOS';

// 캐시 무효화는 메인의 workOS:changed 이벤트를 events.ts 가 수신하여 처리한다.

export const workOSMutations = {
  createStep: () =>
    mutationOptions<Step, Error, CreateStepRequest>({ mutationFn: (r) => workOSApi.createStep(r) }),
  updateStep: () =>
    mutationOptions<Step, Error, UpdateStepRequest>({ mutationFn: (r) => workOSApi.updateStep(r) }),
  deleteStep: () =>
    mutationOptions<void, Error, DeleteStepRequest>({ mutationFn: (r) => workOSApi.deleteStep(r) }),

  createWorkflow: () =>
    mutationOptions<Workflow, Error, CreateWorkflowRequest>({
      mutationFn: (r) => workOSApi.createWorkflow(r),
    }),
  updateWorkflow: () =>
    mutationOptions<Workflow, Error, UpdateWorkflowRequest>({
      mutationFn: (r) => workOSApi.updateWorkflow(r),
    }),
  deleteWorkflow: () =>
    mutationOptions<void, Error, DeleteWorkflowRequest>({
      mutationFn: (r) => workOSApi.deleteWorkflow(r),
    }),

  createTask: () =>
    mutationOptions<Task, Error, CreateTaskRequest>({ mutationFn: (r) => workOSApi.createTask(r) }),
  updateTask: () =>
    mutationOptions<Task, Error, UpdateTaskRequest>({ mutationFn: (r) => workOSApi.updateTask(r) }),
  deleteTask: () =>
    mutationOptions<void, Error, DeleteTaskRequest>({ mutationFn: (r) => workOSApi.deleteTask(r) }),
  decomposeTask: () =>
    mutationOptions<TaskItem[], Error, DecomposeTaskRequest>({
      mutationFn: (r) => workOSApi.decomposeTask(r),
    }),

  createTaskItem: () =>
    mutationOptions<TaskItem, Error, CreateTaskItemRequest>({
      mutationFn: (r) => workOSApi.createTaskItem(r),
    }),
  updateTaskItem: () =>
    mutationOptions<TaskItem, Error, UpdateTaskItemRequest>({
      mutationFn: (r) => workOSApi.updateTaskItem(r),
    }),
  deleteTaskItem: () =>
    mutationOptions<void, Error, DeleteTaskItemRequest>({
      mutationFn: (r) => workOSApi.deleteTaskItem(r),
    }),
  executeTaskItem: () =>
    mutationOptions<ExecuteTaskItemResponse, Error, ExecuteTaskItemRequest>({
      mutationFn: (r) => workOSApi.executeTaskItem(r),
    }),

  gitCommit: () =>
    mutationOptions<GitCommitResponse, Error, GitCommitRequest>({
      mutationFn: (r) => workOSApi.gitCommit(r),
    }),
  gitStagePaths: () =>
    mutationOptions<void, Error, GitStagePathsRequest>({
      mutationFn: (r) => workOSApi.gitStagePaths(r),
    }),
  gitUnstagePaths: () =>
    mutationOptions<void, Error, GitUnstagePathsRequest>({
      mutationFn: (r) => workOSApi.gitUnstagePaths(r),
    }),

  seedPreset: () =>
    mutationOptions<{ workflowId: string }, Error, { workspaceId: string }>({
      mutationFn: (r) => workOSApi.seedPreset(r),
    }),
  requestAiDecompose: () =>
    mutationOptions<
      { sessionId: string; promptFilePath: string; outputJsonPath: string },
      Error,
      { workspaceId: string; taskId: string; cols?: number; rows?: number }
    >({ mutationFn: (r) => workOSApi.requestAiDecompose(r) }),
  importDecomposition: () =>
    mutationOptions<TaskItem[], Error, { workspaceId: string; taskId: string }>({
      mutationFn: (r) => workOSApi.importDecomposition(r),
    }),

  requestAiWorkflowGen: () =>
    mutationOptions<
      {
        draftId: string;
        sessionId: string;
        promptFilePath: string;
        outputJsonPath: string;
      },
      Error,
      { workspaceId: string; requirement: string; cols?: number; rows?: number }
    >({ mutationFn: (r) => workOSApi.requestAiWorkflowGen(r) }),
  importWorkflowDraft: () =>
    mutationOptions<
      { workflowId: string },
      Error,
      { workspaceId: string; draftId: string }
    >({ mutationFn: (r) => workOSApi.importWorkflowDraft(r) }),
};
