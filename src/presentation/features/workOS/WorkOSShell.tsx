import { useState } from 'react';
import { useWorkOSSync } from '../../../business/workOS/use-workOS';
import { useWorkOSStore } from '../../../business/workOS/workOS-store';
import { useHotkey } from '../../shared/use-hotkeys';
import { WorkflowsView } from './WorkflowsView';
import { TasksView } from './TasksView';
import { DiffView } from './DiffView';
import { HelpOverlay } from './HelpOverlay';
import { McpStatusChip } from './McpStatusChip';

type Props = {
  workspaceId: string;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
};

export function WorkOSShell({ workspaceId, terminalOpen, onToggleTerminal }: Props) {
  useWorkOSSync();
  const view = useWorkOSStore((s) => s.viewByWorkspace[workspaceId] ?? 'tasks');
  const setView = useWorkOSStore((s) => s.setView);
  const [helpOpen, setHelpOpen] = useState(false);

  useHotkey('mod+1', () => setView(workspaceId, 'tasks'), [workspaceId]);
  useHotkey('mod+2', () => setView(workspaceId, 'workflows'), [workspaceId]);
  useHotkey('mod+3', () => setView(workspaceId, 'diff'), [workspaceId]);
  useHotkey('mod+j', () => onToggleTerminal(), [onToggleTerminal]);
  useHotkey('shift+/', () => setHelpOpen((x) => !x));

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-1.5">
        <nav className="flex items-center gap-1">
          <ViewTab
            label="태스크"
            shortcut="⌘1"
            active={view === 'tasks'}
            onClick={() => setView(workspaceId, 'tasks')}
          />
          <ViewTab
            label="워크플로"
            shortcut="⌘2"
            active={view === 'workflows'}
            onClick={() => setView(workspaceId, 'workflows')}
          />
          <ViewTab
            label="Diff & 커밋"
            shortcut="⌘3"
            active={view === 'diff'}
            onClick={() => setView(workspaceId, 'diff')}
          />
        </nav>
        <div className="flex items-center gap-2">
          <McpStatusChip workspaceId={workspaceId} />
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-100"
            title="단축키 (?) "
            aria-label="단축키 도움말"
          >
            ?
          </button>
          <button
            type="button"
            onClick={onToggleTerminal}
            className="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700"
            title={`${terminalOpen ? '터미널 패널 닫기' : '터미널 패널 열기'} (⌘J)`}
          >
            {terminalOpen ? '터미널 닫기 →' : '← 터미널 열기'}
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'tasks' && <TasksView workspaceId={workspaceId} />}
        {view === 'workflows' && <WorkflowsView workspaceId={workspaceId} />}
        {view === 'diff' && <DiffView workspaceId={workspaceId} />}
      </div>
      {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function ViewTab({
  label,
  shortcut,
  active,
  onClick,
}: {
  label: string;
  shortcut: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} (${shortcut})`}
      className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors ${
        active
          ? 'bg-emerald-500/15 font-medium text-emerald-300'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      <span>{label}</span>
      <kbd className="hidden rounded bg-slate-800 px-1 text-[10px] text-slate-500 sm:inline">
        {shortcut}
      </kbd>
    </button>
  );
}
