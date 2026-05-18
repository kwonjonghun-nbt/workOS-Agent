import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  workOSEvents,
  workOSKeys,
  workOSMutations,
  workOSQueries,
} from '../../server-state/workOS';
import { terminalKeys } from '../../server-state/terminal';

/**
 * workOS 채널이 새 터미널 세션을 만든 직후엔 main 의 sessions Map 만 갱신되고
 * renderer 의 `terminal:list` 캐시는 그대로다. 결과적으로 우측 터미널 패널에 새 세션이
 * 즉시 보이지 않는다 — 채널 호출자(executeTaskItem 등) 의 onSuccess 에서 invalidate.
 */
function useInvalidateTerminalsOnSpawn() {
  const qc = useQueryClient();
  return (workspaceId: string) => {
    qc.invalidateQueries({ queryKey: terminalKeys.listByWorkspace(workspaceId) });
  };
}

/**
 * 메인 broadcast(workOS:changed)를 받으면 영향 받은 entity 캐시를 invalidate.
 * 한 hook 만 마운트해도 전역에 충분 — App 루트에서 부른다.
 */
export function useWorkOSSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const off = workOSEvents.subscribeChanged((evt) => {
      const map = {
        step: workOSKeys.steps(evt.workspaceId),
        workflow: workOSKeys.workflows(evt.workspaceId),
        task: workOSKeys.tasks(evt.workspaceId),
        'task-item': workOSKeys.taskItems(evt.workspaceId),
      } as const;
      for (const k of evt.kinds) qc.invalidateQueries({ queryKey: map[k] });
    });
    return off;
  }, [qc]);
}

export function useSteps(workspaceId: string) {
  return useQuery(workOSQueries.steps(workspaceId));
}
export function useWorkflows(workspaceId: string) {
  return useQuery(workOSQueries.workflows(workspaceId));
}
export function useTasks(workspaceId: string) {
  return useQuery(workOSQueries.tasks(workspaceId));
}
export function useTaskItems(workspaceId: string) {
  return useQuery(workOSQueries.taskItems(workspaceId));
}
export function useCatalog(workspaceId: string) {
  return useQuery(workOSQueries.catalog(workspaceId));
}
export function useGitDiff(workspaceId: string) {
  return useQuery(workOSQueries.gitDiff(workspaceId));
}

export function useCreateStep() {
  return useMutation(workOSMutations.createStep());
}
export function useUpdateStep() {
  return useMutation(workOSMutations.updateStep());
}
export function useDeleteStep() {
  return useMutation(workOSMutations.deleteStep());
}
export function useMergeDuplicateSteps() {
  return useMutation(workOSMutations.mergeDuplicateSteps());
}
export function useCreateWorkflow() {
  return useMutation(workOSMutations.createWorkflow());
}
export function useUpdateWorkflow() {
  return useMutation(workOSMutations.updateWorkflow());
}
export function useDeleteWorkflow() {
  return useMutation(workOSMutations.deleteWorkflow());
}
export function useCreateTask() {
  return useMutation(workOSMutations.createTask());
}
export function useUpdateTask() {
  return useMutation(workOSMutations.updateTask());
}
export function useDeleteTask() {
  return useMutation(workOSMutations.deleteTask());
}
export function useDecomposeTask() {
  return useMutation(workOSMutations.decomposeTask());
}
export function useCreateTaskItem() {
  return useMutation(workOSMutations.createTaskItem());
}
export function useUpdateTaskItem() {
  return useMutation(workOSMutations.updateTaskItem());
}
export function useDeleteTaskItem() {
  return useMutation(workOSMutations.deleteTaskItem());
}
export function useExecuteTaskItem() {
  const invalidate = useInvalidateTerminalsOnSpawn();
  return useMutation({
    ...workOSMutations.executeTaskItem(),
    onSuccess: (_data, vars) => invalidate(vars.workspaceId),
  });
}
function useInvalidateGitOnMutate() {
  const qc = useQueryClient();
  return (workspaceId: string) => {
    qc.invalidateQueries({ queryKey: workOSKeys.gitStatus(workspaceId) });
    qc.invalidateQueries({ queryKey: workOSKeys.gitDiff(workspaceId) });
    qc.invalidateQueries({ queryKey: [...workOSKeys.all, 'git-file-diff', workspaceId] });
  };
}

export function useGitStatus(workspaceId: string) {
  return useQuery(workOSQueries.gitStatus(workspaceId));
}
export function useGitFileDiff(
  workspaceId: string,
  path: string | null,
  side: 'staged' | 'unstaged',
) {
  return useQuery(workOSQueries.gitFileDiff(workspaceId, path, side));
}
export function useGitStagePaths() {
  const invalidate = useInvalidateGitOnMutate();
  return useMutation({
    ...workOSMutations.gitStagePaths(),
    onSuccess: (_d, vars) => invalidate(vars.workspaceId),
  });
}
export function useGitUnstagePaths() {
  const invalidate = useInvalidateGitOnMutate();
  return useMutation({
    ...workOSMutations.gitUnstagePaths(),
    onSuccess: (_d, vars) => invalidate(vars.workspaceId),
  });
}
export function useGitCommit() {
  const invalidate = useInvalidateGitOnMutate();
  return useMutation({
    ...workOSMutations.gitCommit(),
    onSuccess: (_d, vars) => invalidate(vars.workspaceId),
  });
}
export function useSeedPreset() {
  return useMutation(workOSMutations.seedPreset());
}
export function useRequestAiDecompose() {
  const invalidate = useInvalidateTerminalsOnSpawn();
  return useMutation({
    ...workOSMutations.requestAiDecompose(),
    onSuccess: (_data, vars) => invalidate(vars.workspaceId),
  });
}
export function useImportDecomposition() {
  return useMutation(workOSMutations.importDecomposition());
}
export function useRequestAiWorkflowGen() {
  const invalidate = useInvalidateTerminalsOnSpawn();
  return useMutation({
    ...workOSMutations.requestAiWorkflowGen(),
    onSuccess: (_data, vars) => invalidate(vars.workspaceId),
  });
}
export function useImportWorkflowDraft() {
  return useMutation(workOSMutations.importWorkflowDraft());
}
