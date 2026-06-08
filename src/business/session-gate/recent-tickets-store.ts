import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 세션 게이트에서 최근 선택/생성한 Jira 티켓을 로컬에 보관한다(최대 3개).
// 다음 세션 시작 시 "최근 티켓"으로 빠르게 다시 고를 수 있게 한다.

export type RecentTicket = {
  key: string;
  summary: string;
  url: string;
};

const MAX_RECENT = 3;

type RecentTicketsStore = {
  recent: RecentTicket[];
  /** 가장 최근이 맨 앞. 같은 키는 합치고 최대 3개로 자른다. */
  add: (ticket: RecentTicket) => void;
};

export const useRecentTicketsStore = create<RecentTicketsStore>()(
  persist(
    (set) => ({
      recent: [],
      add: (ticket) =>
        set((s) => ({
          recent: [ticket, ...s.recent.filter((r) => r.key !== ticket.key)].slice(
            0,
            MAX_RECENT,
          ),
        })),
    }),
    {
      name: 'workos-agent:recent-jira-tickets',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
