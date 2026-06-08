import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 세션 게이트 "새 티켓 생성"에서 최근 선택/생성한 에픽을 로컬에 보관한다.
// 에픽은 프로젝트별이므로 projectKey 와 함께 저장하고, 현재 프로젝트 것만 골라
// 최대 3개를 보여준다(전역으로는 여러 프로젝트분을 넉넉히 보관).

export type RecentEpic = {
  key: string;
  summary: string;
  projectKey: string;
};

/** 전역 보관 한도(여러 프로젝트분). 표시는 프로젝트별로 최대 3개. */
const MAX_STORED = 24;
export const MAX_RECENT_EPICS_PER_PROJECT = 3;

type RecentEpicsStore = {
  recent: RecentEpic[];
  add: (epic: RecentEpic) => void;
};

export const useRecentEpicsStore = create<RecentEpicsStore>()(
  persist(
    (set) => ({
      recent: [],
      add: (epic) =>
        set((s) => ({
          recent: [epic, ...s.recent.filter((r) => r.key !== epic.key)].slice(0, MAX_STORED),
        })),
    }),
    {
      name: 'workos-agent:recent-jira-epics',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
