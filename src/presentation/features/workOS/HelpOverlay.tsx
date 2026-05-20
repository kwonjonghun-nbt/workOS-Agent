import { useEffect } from 'react';

type Props = { onClose: () => void };

const SHORTCUTS: Array<[string, string]> = [
  ['⌘1', '태스크 뷰'],
  ['⌘2', '워크플로 뷰'],
  ['⌘3', 'Diff & 커밋 뷰'],
  ['⌘J', '터미널 패널 토글'],
  ['?', '이 도움말 표시/숨김'],
  ['Esc', '도움말 닫기'],
];

const FLOW: Array<[string, string]> = [
  ['1.', '워크스페이스(프로젝트 루트 폴더)를 엽니다. 상단 + 폴더 열기.'],
  ['2.', '워크플로 탭에서 ‘Step 라이브러리’로 Step을 만들고, 워크플로에 순서대로 끼웁니다. (혹은 빈 화면의 “샘플 워크플로 한 번에 만들기” 사용)'],
  ['3.', '태스크 탭에서 워크플로 선택 → Task 생성 → 요구사항 붙여넣기.'],
  ['4.', '⚡ 분해 (결정적) 또는 🧠 AI 분해 (Claude CLI 호출)로 TaskItem을 생성합니다.'],
  ['5.', '각 TaskItem의 ▶ 실행 — 새 터미널 세션에서 Claude CLI가 그 단위만 수행합니다.'],
  ['6.', 'Diff & 커밋 탭에서 변경을 검토하고 의미 있는 단위로 커밋합니다.'],
];

export function HelpOverlay({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">workOS-Agent 사용 가이드</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-ink-400 hover:bg-ink-850 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-claude-300">
            E2E 작업 흐름
          </h3>
          <ol className="space-y-1.5 text-sm text-ink-200">
            {FLOW.map(([n, d]) => (
              <li key={n} className="flex gap-2">
                <span className="w-6 shrink-0 text-ink-500">{n}</span>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-claude-300">
            단축키
          </h3>
          <ul className="grid grid-cols-2 gap-1.5 text-sm">
            {SHORTCUTS.map(([k, d]) => (
              <li key={k} className="flex items-center gap-2">
                <kbd className="min-w-[40px] rounded border border-ink-700 bg-ink-850 px-1.5 py-0.5 text-center text-xs text-ink-200">
                  {k}
                </kbd>
                <span className="text-ink-300">{d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded border border-ink-850 bg-ink-950/60 p-3 text-xs text-ink-400">
          <strong className="text-ink-200">왜 새 터미널 세션인가?</strong>{' '}
          매 TaskItem 실행마다 새 Claude CLI 세션을 띄워 컨텍스트를 격리합니다. 이전 단계의
          잔여 컨텍스트가 다음 단계 판단을 흐리지 않게 하기 위함입니다.
        </section>
      </div>
    </div>
  );
}
