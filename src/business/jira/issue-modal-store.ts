import { create } from 'zustand';

type State = {
  openedKey: string | null;
  open: (key: string) => void;
  close: () => void;
};

export const useIssueModalStore = create<State>((set) => ({
  openedKey: null,
  open: (key) => set({ openedKey: key }),
  close: () => set({ openedKey: null }),
}));
