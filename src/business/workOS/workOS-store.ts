import { create } from 'zustand';

// 워크OS UI 상태 — 현재 선택된 워크플로/태스크/태스크아이템 (워크스페이스별로 격리)

type View = 'workflows' | 'tasks' | 'diff';

export type AiWorkflowDraft = {
  draftId: string;
  outputJsonPath: string;
  requirement: string;
  sessionId: string;
  startedAt: number;
};

type WorkOSUiState = {
  viewByWorkspace: Record<string, View | undefined>;
  selectedWorkflowByWorkspace: Record<string, string | null | undefined>;
  selectedTaskByWorkspace: Record<string, string | null | undefined>;
  selectedTaskItemByWorkspace: Record<string, string | null | undefined>;
  aiWorkflowDraftByWorkspace: Record<string, AiWorkflowDraft | undefined>;

  setView: (workspaceId: string, view: View) => void;
  selectWorkflow: (workspaceId: string, id: string | null) => void;
  selectTask: (workspaceId: string, id: string | null) => void;
  selectTaskItem: (workspaceId: string, id: string | null) => void;
  setAiWorkflowDraft: (workspaceId: string, draft: AiWorkflowDraft | null) => void;
};

export const useWorkOSStore = create<WorkOSUiState>((set) => ({
  viewByWorkspace: {},
  selectedWorkflowByWorkspace: {},
  selectedTaskByWorkspace: {},
  selectedTaskItemByWorkspace: {},
  aiWorkflowDraftByWorkspace: {},

  setView: (workspaceId, view) =>
    set((s) => ({ viewByWorkspace: { ...s.viewByWorkspace, [workspaceId]: view } })),
  selectWorkflow: (workspaceId, id) =>
    set((s) => ({
      selectedWorkflowByWorkspace: { ...s.selectedWorkflowByWorkspace, [workspaceId]: id },
    })),
  selectTask: (workspaceId, id) =>
    set((s) => ({
      selectedTaskByWorkspace: { ...s.selectedTaskByWorkspace, [workspaceId]: id },
    })),
  selectTaskItem: (workspaceId, id) =>
    set((s) => ({
      selectedTaskItemByWorkspace: { ...s.selectedTaskItemByWorkspace, [workspaceId]: id },
    })),
  setAiWorkflowDraft: (workspaceId, draft) =>
    set((s) => {
      const next = { ...s.aiWorkflowDraftByWorkspace };
      if (draft) next[workspaceId] = draft;
      else delete next[workspaceId];
      return { aiWorkflowDraftByWorkspace: next };
    }),
}));
