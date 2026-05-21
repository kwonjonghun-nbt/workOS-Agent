import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// UI-only selection state for the activity bar.
//  - activeViewKey: which contributed view is currently expanded, or null if
//    the side panel is collapsed. View keys are namespaced as
//    `${extensionId}:${viewId}` so multiple extensions can contribute views
//    with the same id.
//  - settingsTabExtensionId: when the user opens an extension's settings page,
//    which one is selected.

type ExtensionUiStore = {
  activeViewKey: string | null;
  setActiveView: (key: string | null) => void;
  // Per-extension toggle for the host-provided AI terminal slot, shown beneath
  // the extension view content. Independent from view selection so toggling a
  // view doesn't tear down a running terminal.
  terminalOpenByExtension: Record<string, boolean | undefined>;
  toggleTerminal: (extensionId: string) => void;
  setTerminalOpen: (extensionId: string, open: boolean) => void;
  // Active session per extension's terminal panel (which tab is focused).
  activeTerminalIdByExtension: Record<string, string | undefined>;
  setActiveTerminal: (extensionId: string, sessionId: string | null) => void;
};

export const useExtensionStore = create<ExtensionUiStore>()(
  persist(
    (set) => ({
      activeViewKey: null,
      setActiveView: (key) => set({ activeViewKey: key }),
      terminalOpenByExtension: {},
      toggleTerminal: (extensionId) =>
        set((state) => ({
          terminalOpenByExtension: {
            ...state.terminalOpenByExtension,
            [extensionId]: !state.terminalOpenByExtension[extensionId],
          },
        })),
      setTerminalOpen: (extensionId, open) =>
        set((state) => ({
          terminalOpenByExtension: {
            ...state.terminalOpenByExtension,
            [extensionId]: open,
          },
        })),
      activeTerminalIdByExtension: {},
      setActiveTerminal: (extensionId, sessionId) =>
        set((state) => ({
          activeTerminalIdByExtension: {
            ...state.activeTerminalIdByExtension,
            [extensionId]: sessionId ?? undefined,
          },
        })),
    }),
    {
      name: 'workos-agent:extension-ui',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      partialize: (state) => ({
        activeViewKey: state.activeViewKey,
        terminalOpenByExtension: state.terminalOpenByExtension,
        activeTerminalIdByExtension: state.activeTerminalIdByExtension,
      }),
    },
  ),
);

export function viewKey(extensionId: string, viewId: string): string {
  return `${extensionId}:${viewId}`;
}

export function parseViewKey(
  key: string,
): { extensionId: string; viewId: string } | null {
  const idx = key.indexOf(':');
  if (idx === -1) return null;
  return { extensionId: key.slice(0, idx), viewId: key.slice(idx + 1) };
}
