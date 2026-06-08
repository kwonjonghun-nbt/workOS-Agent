import { useEffect, useState } from 'react';
import { useSessionGate } from '../../../business/session-gate/use-session-gate';
import { ChooseStep } from './steps/ChooseStep';
import { CreateStep } from './steps/CreateStep';
import { SelectStep } from './steps/SelectStep';

type Mode = 'choose' | 'create' | 'select';

/**
 * Session-Start Jira Gate modal. Blocks at the app root while a claude session
 * is starting and waiting on the gate. The user must create a new ticket (under
 * a required Epic), pick an existing one, or explicitly skip — no backdrop dismiss.
 *
 * 오케스트레이터만 담당한다: 게이트 상태(useSessionGate) + 스텝 전환(mode).
 * 각 스텝(Choose/Create/Select)은 독립 모듈이며 props 로만 값을 주고받는다.
 */
export function SessionGateModal() {
  const gate = useSessionGate();
  const [mode, setMode] = useState<Mode>('choose');

  // 새 게이트가 열리면 항상 첫 화면(choose)부터.
  useEffect(() => {
    if (gate.active) setMode('choose');
  }, [gate.active?.requestId]);

  if (!gate.active) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-claude-500/40 bg-ink-900 shadow-2xl">
        <header className="flex items-center gap-2 border-b border-ink-850 px-5 py-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-claude-400" />
          <h2 className="text-base font-semibold text-white">이 세션의 Jira 티켓을 정하세요</h2>
        </header>

        {mode === 'choose' && (
          <ChooseStep
            onCreate={() => setMode('create')}
            onSelect={() => setMode('select')}
            onSkip={() => void gate.skip()}
            submitting={gate.submitting}
          />
        )}
        {mode === 'create' && (
          <CreateStep
            submitting={gate.submitting}
            error={gate.createError}
            onBack={() => setMode('choose')}
            onSubmit={(form) => void gate.createAndUse(form)}
          />
        )}
        {mode === 'select' && (
          <SelectStep
            submitting={gate.submitting}
            onBack={() => setMode('choose')}
            onPick={(issue) => void gate.selectExisting(issue)}
          />
        )}
      </div>
    </div>
  );
}
