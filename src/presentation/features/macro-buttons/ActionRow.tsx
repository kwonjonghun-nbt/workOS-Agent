import { macroApi } from '../../../api/macro';
import type { KeystrokeStep, PickPathMode } from '../../../api/macro';
import type { MacroAction, MacroActionKind, HttpMethod } from '../../../server-state/macro';

const KIND_LABELS: Record<MacroActionKind, string> = {
  shell: 'Shell',
  http: 'HTTP',
  delay: 'Delay',
  'os.open': 'Open',
  'os.clipboard': 'Clipboard',
  keystroke: 'Keystroke',
  ai: 'AI',
};

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function blankAction(kind: MacroActionKind): MacroAction {
  switch (kind) {
    case 'shell':
      return { kind: 'shell', command: '' };
    case 'http':
      return { kind: 'http', method: 'GET', url: 'https://' };
    case 'delay':
      return { kind: 'delay', ms: 500 };
    case 'os.open':
      return { kind: 'os.open', target: '' };
    case 'os.clipboard':
      return { kind: 'os.clipboard', text: '' };
    case 'keystroke':
      return { kind: 'keystroke', app: '', steps: [{ type: 'keys', keys: '' }] };
    case 'ai':
      return { kind: 'ai', prompt: '', output: 'clipboard' };
  }
}

type Props = {
  index: number;
  action: MacroAction;
  total: number;
  onChange: (next: MacroAction) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
};

export function ActionRow({ index, action, total, onChange, onRemove, onMove }: Props) {
  const supportsContinue =
    action.kind !== 'delay' && action.kind !== 'os.clipboard';

  return (
    <div className="rounded-md border border-ink-700 bg-ink-900/60 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-ink-400">
            {index + 1}
          </span>
          <select
            value={action.kind}
            onChange={(e) => onChange(blankAction(e.target.value as MacroActionKind))}
            className="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-100"
          >
            {Object.entries(KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="↑" onClick={() => onMove(-1)} disabled={index === 0} />
          <IconBtn
            label="↓"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
          />
          <IconBtn label="✕" onClick={onRemove} danger />
        </div>
      </div>

      <ActionFields action={action} onChange={onChange} />

      {supportsContinue && (
        <label className="mt-2 flex items-center gap-2 text-[11px] text-ink-400">
          <input
            type="checkbox"
            checked={'continueOnError' in action && action.continueOnError === true}
            onChange={(e) =>
              onChange({ ...action, continueOnError: e.target.checked || undefined })
            }
          />
          실패해도 계속 진행
        </label>
      )}
    </div>
  );
}

function ActionFields({
  action,
  onChange,
}: {
  action: MacroAction;
  onChange: (next: MacroAction) => void;
}) {
  switch (action.kind) {
    case 'shell':
      return (
        <Field label="Command">
          <input
            type="text"
            value={action.command}
            onChange={(e) => onChange({ ...action, command: e.target.value })}
            placeholder="echo hello"
            className={inputClass}
          />
        </Field>
      );

    case 'http':
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={action.method}
              onChange={(e) =>
                onChange({ ...action, method: e.target.value as HttpMethod })
              }
              className="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-100"
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={action.url}
              onChange={(e) => onChange({ ...action, url: e.target.value })}
              placeholder="https://example.com/hook"
              className={`${inputClass} flex-1`}
            />
          </div>
          <Field label="Body (선택)">
            <textarea
              value={action.body ?? ''}
              onChange={(e) =>
                onChange({ ...action, body: e.target.value || undefined })
              }
              rows={2}
              className={`${inputClass} font-mono`}
            />
          </Field>
        </div>
      );

    case 'delay':
      return (
        <Field label="ms">
          <input
            type="number"
            value={action.ms}
            min={0}
            max={60_000}
            onChange={(e) =>
              onChange({ ...action, ms: Math.max(0, Number(e.target.value) || 0) })
            }
            className={`${inputClass} w-32`}
          />
        </Field>
      );

    case 'os.open':
      return (
        <Field label="URL · 앱 · 파일 · 폴더">
          <div className="flex gap-1">
            <input
              type="text"
              value={action.target}
              onChange={(e) => onChange({ ...action, target: e.target.value })}
              placeholder="https://… 또는 /Applications/Slack.app"
              className={`${inputClass} flex-1`}
            />
            <PickPathButton
              mode="app"
              label="📱"
              tooltip="애플리케이션 선택"
              onPick={(p) => onChange({ ...action, target: p })}
            />
            <PickPathButton
              mode="file"
              label="📄"
              tooltip="파일 선택"
              onPick={(p) => onChange({ ...action, target: p })}
            />
            <PickPathButton
              mode="directory"
              label="📁"
              tooltip="폴더 선택"
              onPick={(p) => onChange({ ...action, target: p })}
            />
          </div>
        </Field>
      );

    case 'os.clipboard':
      return (
        <Field label="복사할 텍스트">
          <textarea
            value={action.text}
            onChange={(e) => onChange({ ...action, text: e.target.value })}
            rows={2}
            className={inputClass}
          />
        </Field>
      );

    case 'ai':
      return (
        <div className="space-y-2">
          <Field label="프롬프트 (claude 가 받을 메시지)">
            <textarea
              value={action.prompt}
              onChange={(e) => onChange({ ...action, prompt: e.target.value })}
              placeholder="예: 다음 텍스트를 영어로 번역해줘 — {{clipboard}}"
              rows={3}
              className={inputClass}
            />
          </Field>
          <Field label="결과 출력 위치">
            <select
              value={action.output}
              onChange={(e) =>
                onChange({
                  ...action,
                  output: e.target.value as 'clipboard' | 'echo',
                })
              }
              className="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-100"
            >
              <option value="clipboard">클립보드에 복사 (다음 액션에서 {'{{clipboard}}'} 로 사용)</option>
              <option value="echo">터미널에 출력만</option>
            </select>
          </Field>
        </div>
      );

    case 'keystroke':
      return <KeystrokeEditor action={action} onChange={onChange} />;
  }
}

function KeystrokeEditor({
  action,
  onChange,
}: {
  action: Extract<MacroAction, { kind: 'keystroke' }>;
  onChange: (next: MacroAction) => void;
}) {
  const updateStep = (i: number, next: KeystrokeStep) =>
    onChange({
      ...action,
      steps: action.steps.map((s, idx) => (idx === i ? next : s)),
    });
  const removeStep = (i: number) =>
    onChange({ ...action, steps: action.steps.filter((_, idx) => idx !== i) });
  const moveStep = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= action.steps.length) return;
    const next = [...action.steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...action, steps: next });
  };
  const addStep = (type: KeystrokeStep['type']) => {
    const fresh: KeystrokeStep =
      type === 'keys'
        ? { type: 'keys', keys: '' }
        : type === 'text'
          ? { type: 'text', text: '' }
          : { type: 'wait', ms: 200 };
    onChange({ ...action, steps: [...action.steps, fresh] });
  };

  return (
    <div className="space-y-2">
      <Field label="대상 앱 (선택)">
        <input
          type="text"
          value={action.app ?? ''}
          onChange={(e) =>
            onChange({ ...action, app: e.target.value || undefined })
          }
          placeholder="예: Slack, Safari, Visual Studio Code"
          className={inputClass}
        />
      </Field>
      <p className="text-[10px] leading-relaxed text-ink-500">
        🍎 macOS 전용. 첫 실행 시 시스템 설정 &gt; 개인정보 보호 및 보안 &gt; 손쉬운 사용 권한
        요청. 키 표기: <code className="text-ink-300">cmd+shift+t</code>,{' '}
        <code className="text-ink-300">cmd+space</code>,{' '}
        <code className="text-ink-300">enter</code>,{' '}
        <code className="text-ink-300">up</code>,{' '}
        <code className="text-ink-300">f5</code> 등.
      </p>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-ink-500">
            스텝 ({action.steps.length})
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => addStep('keys')}
              className="rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-[10px] text-ink-300 hover:bg-ink-800"
            >
              + 키
            </button>
            <button
              type="button"
              onClick={() => addStep('text')}
              className="rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-[10px] text-ink-300 hover:bg-ink-800"
            >
              + 텍스트
            </button>
            <button
              type="button"
              onClick={() => addStep('wait')}
              className="rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-[10px] text-ink-300 hover:bg-ink-800"
            >
              + 대기
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          {action.steps.map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-1 rounded border border-ink-800 bg-ink-950 p-1.5"
            >
              <span className="w-5 shrink-0 text-center font-mono text-[10px] text-ink-500">
                {i + 1}
              </span>
              <span className="w-12 shrink-0 text-[10px] uppercase tracking-wider text-ink-400">
                {step.type}
              </span>
              {step.type === 'keys' && (
                <input
                  type="text"
                  value={step.keys}
                  onChange={(e) =>
                    updateStep(i, { ...step, keys: e.target.value })
                  }
                  placeholder="cmd+shift+t"
                  className={`${inputClass} font-mono`}
                />
              )}
              {step.type === 'text' && (
                <input
                  type="text"
                  value={step.text}
                  onChange={(e) =>
                    updateStep(i, { ...step, text: e.target.value })
                  }
                  placeholder="hello world"
                  className={inputClass}
                />
              )}
              {step.type === 'wait' && (
                <input
                  type="number"
                  value={step.ms}
                  min={0}
                  max={10_000}
                  onChange={(e) =>
                    updateStep(i, { ...step, ms: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className={`${inputClass} w-24`}
                />
              )}
              {step.type !== 'wait' && (
                <input
                  type="number"
                  value={step.delayMs ?? ''}
                  placeholder="ms"
                  min={0}
                  max={10_000}
                  onChange={(e) =>
                    updateStep(i, {
                      ...step,
                      delayMs: e.target.value
                        ? Math.max(0, Number(e.target.value) || 0)
                        : undefined,
                    })
                  }
                  title="이 스텝 직후 대기 시간 (ms)"
                  className={`${inputClass} w-16`}
                />
              )}
              <button
                type="button"
                onClick={() => moveStep(i, -1)}
                disabled={i === 0}
                className="rounded text-xs text-ink-500 hover:text-ink-200 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveStep(i, 1)}
                disabled={i === action.steps.length - 1}
                className="rounded text-xs text-ink-500 hover:text-ink-200 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeStep(i)}
                className="rounded text-xs text-rose-400 hover:text-rose-300"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-6 w-6 rounded text-xs leading-none ${
        danger
          ? 'text-rose-400 hover:bg-rose-500/10'
          : 'text-ink-400 hover:bg-ink-800'
      } disabled:opacity-30`}
    >
      {label}
    </button>
  );
}

function PickPathButton({
  mode,
  label,
  tooltip,
  onPick,
}: {
  mode: PickPathMode;
  label: string;
  tooltip: string;
  onPick: (path: string) => void;
}) {
  const handleClick = async () => {
    try {
      const { path } = await macroApi.pickPath({ mode });
      if (path) onPick(path);
    } catch {
      // dialog cancellation surfaces as path: null already; ignore errors here
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      title={tooltip}
      className="shrink-0 rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800"
    >
      {label}
    </button>
  );
}

const inputClass =
  'w-full rounded border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-100 outline-none focus:border-claude-500';
