import { create } from 'zustand';

// 워크스페이스 메타데이터(목록, 이름, 경로)는 메인 프로세스가 SSOT 이고
// react-query 가 그 캐시이다. 이 스토어에는 UI 관심사만 둔다:
//  - 열어둔 탭 (서버 list 의 부분집합)
//  - 활성 탭
//  - 워크스페이스별 활성 터미널 (UI 만의 선택 상태)

type WorkspaceUiStore = {
  openIds: string[];
  activeId: string | null;
  activeTerminalIdByWorkspace: Record<string, string | undefined>;
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
  setActive: (id: string | null) => void;
  setActiveTerminal: (workspaceId: string, sessionId: string | null) => void;
  /** 메인 SSOT 에서 사라진 워크스페이스를 UI 상태에서 정리. */
  pruneMissing: (existingIds: ReadonlySet<string>) => void;
};

export const useWorkspaceStore = create<WorkspaceUiStore>((set) => ({
  openIds: [],
  activeId: null,
  activeTerminalIdByWorkspace: {},

  openTab: (id) =>
    set((state) => {
      if (state.openIds.includes(id)) {
        return { activeId: id };
      }
      return { openIds: [...state.openIds, id], activeId: id };
    }),

  closeTab: (id) =>
    set((state) => {
      const openIds = state.openIds.filter((x) => x !== id);
      let activeId = state.activeId;
      if (activeId === id) {
        activeId = openIds[openIds.length - 1] ?? null;
      }
      const rest = { ...state.activeTerminalIdByWorkspace };
      delete rest[id];
      return { openIds, activeId, activeTerminalIdByWorkspace: rest };
    }),

  setActive: (id) => set({ activeId: id }),

  setActiveTerminal: (workspaceId, sessionId) =>
    set((state) => ({
      activeTerminalIdByWorkspace: {
        ...state.activeTerminalIdByWorkspace,
        [workspaceId]: sessionId ?? undefined,
      },
    })),

  pruneMissing: (existingIds) =>
    set((state) => {
      const openIds = state.openIds.filter((id) => existingIds.has(id));
      let activeId = state.activeId;
      if (activeId && !existingIds.has(activeId)) {
        activeId = openIds[openIds.length - 1] ?? null;
      }
      const activeTerminalIdByWorkspace: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(state.activeTerminalIdByWorkspace)) {
        if (existingIds.has(k)) activeTerminalIdByWorkspace[k] = v;
      }
      return { openIds, activeId, activeTerminalIdByWorkspace };
    }),
}));
