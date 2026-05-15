import { create } from 'zustand';

// 멀티 터미널 클라이언트 상태.
// - 현재는 이름과 sessionId 정도만 관리한다.
// - 추후 상태(running/exited), cwd, 마지막 출력 시각 등 메타데이터가 늘어날 수 있다.
// - 메인 프로세스가 권위 있는 SSOT 가 되어야 하면 (멀티 윈도우, 외부 트리거, 리로드 복구 등)
//   terminal:list IPC 채널로 받아오는 방식으로 전환한다. (TerminalPanel.tsx 상단 주석 참고)

export type Terminal = {
  /** 클라이언트가 발급하는 ID (UI key, store key). xterm 인스턴스 1:1 매핑. */
  id: string;
  /** 사용자 표시 이름. 기본값은 `section{n}`. */
  name: string;
  /** 메인 프로세스 pty 세션 ID. TerminalView 가 마운트되어 create 가 끝난 뒤 채워진다. */
  sessionId: string | null;
};

type TerminalStore = {
  terminals: Terminal[];
  addTerminal: () => string;
  removeTerminal: (id: string) => void;
  renameTerminal: (id: string, name: string) => void;
  setSessionId: (id: string, sessionId: string) => void;
};

const nextDefaultName = (terminals: Terminal[]) => {
  // 기존 이름들 중 `section{n}` 패턴의 최대값 + 1.
  // 중간 삭제가 있어도 새 이름이 충돌하지 않도록 단조 증가시킨다.
  const used = new Set(terminals.map((t) => t.name));
  let n = terminals.length + 1;
  while (used.has(`section${n}`)) n += 1;
  return `section${n}`;
};

// "지금 어떤 탭이 선택됐는지" 는 UI 관심사이므로 presentation 레이어에서 관리한다.
// (TerminalPanel 의 useState 참고.) 이 스토어는 도메인 상태(목록·이름·sessionId)만 가진다.

export const useTerminalStore = create<TerminalStore>((set) => ({
  terminals: [],

  addTerminal: () => {
    const id = crypto.randomUUID();
    set((state) => ({
      terminals: [
        ...state.terminals,
        { id, name: nextDefaultName(state.terminals), sessionId: null },
      ],
    }));
    return id;
  },

  removeTerminal: (id) => {
    set((state) => ({ terminals: state.terminals.filter((t) => t.id !== id) }));
  },

  renameTerminal: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, name: trimmed } : t)),
    }));
  },

  setSessionId: (id, sessionId) => {
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, sessionId } : t)),
    }));
  },
}));
