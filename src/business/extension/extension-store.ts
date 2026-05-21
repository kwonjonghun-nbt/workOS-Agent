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
};

export const useExtensionStore = create<ExtensionUiStore>()(
  persist(
    (set) => ({
      activeViewKey: null,
      setActiveView: (key) => set({ activeViewKey: key }),
    }),
    {
      name: 'workos-agent:extension-ui',
      storage: createJSONStorage(() => localStorage),
      version: 2,
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
