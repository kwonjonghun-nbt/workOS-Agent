import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error' | 'warning';

export type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
};

type ToastStore = {
  items: Toast[];
  push: (t: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ items: [...s.items, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
    }, t.kind === 'error' ? 8000 : 3500);
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export const toast = {
  info: (message: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'info', message, detail }),
  success: (message: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'success', message, detail }),
  error: (message: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'error', message, detail }),
  warning: (message: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'warning', message, detail }),
};
