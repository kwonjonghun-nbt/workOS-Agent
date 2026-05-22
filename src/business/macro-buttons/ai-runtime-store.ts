import { create } from 'zustand';
import { macroApi } from '../../api/macro';
import type { SuggestTileResponse } from '../../api/macro';

// AI macro-generation runtime state lives outside the React tree so it
// survives navigating away from the macro extension panel. The actual claude
// CLI call is started via macroApi.suggestTile (a plain Promise), so the
// in-flight request keeps running regardless of which view is mounted.

export type AiRuntimeStatus = 'idle' | 'pending' | 'error' | 'ready';

type AiRuntimeStore = {
  // UI state — whether the full modal is visible vs. minimized to a chip.
  modalOpen: boolean;
  backgrounded: boolean;

  // Form state — prompt text is preserved across minimize/restore.
  prompt: string;

  // Async state.
  status: AiRuntimeStatus;
  error: string | null;
  result: SuggestTileResponse | null;

  // Actions
  setPrompt: (next: string) => void;
  openModal: () => void;
  minimize: () => void;
  restore: () => void;
  cancel: () => void;
  consumeResult: () => SuggestTileResponse | null;
  submit: (prompt: string) => Promise<void>;
};

export const useAiRuntimeStore = create<AiRuntimeStore>((set, get) => ({
  modalOpen: false,
  backgrounded: false,
  prompt: '',
  status: 'idle',
  error: null,
  result: null,

  setPrompt: (prompt) => set({ prompt }),

  openModal: () => set({ modalOpen: true, backgrounded: false }),

  minimize: () => set({ modalOpen: false, backgrounded: true }),

  restore: () => set({ modalOpen: true, backgrounded: false }),

  cancel: () =>
    set({
      modalOpen: false,
      backgrounded: false,
      prompt: '',
      status: 'idle',
      error: null,
      result: null,
    }),

  consumeResult: () => {
    const result = get().result;
    set({ result: null, status: 'idle', backgrounded: false, modalOpen: false, prompt: '' });
    return result;
  },

  submit: async (prompt) => {
    set({ status: 'pending', error: null, result: null });
    try {
      const response = await macroApi.suggestTile({ prompt });
      // Late return: if the user cancelled while we were waiting, the status
      // will have been reset to 'idle'. Drop the result quietly.
      if (get().status !== 'pending') return;
      set({ status: 'ready', result: response });
    } catch (err) {
      if (get().status !== 'pending') return;
      set({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
}));
