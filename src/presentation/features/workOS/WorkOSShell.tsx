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
    <div className="flex h-full w-full flex-col bg-ink-900 text-white">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-ink-800 bg-ink-900/80 px-3 backdrop-blur">
        <nav className="flex items-center gap-0.5 rounded-full bg-ink-850/60 p-0.5">
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
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-850 hover:text-white"
            title="단축키 (?) "
            aria-label="단축키 도움말"
          >
            ?
          </button>
          <button
            type="button"
            onClick={onToggleTerminal}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-800 px-3 py-1 text-xs text-ink-300 transition-colors hover:border-ink-700 hover:bg-ink-850 hover:text-white"
            title={`${terminalOpen ? '터미널 패널 닫기' : '터미널 패널 열기'} (⌘J)`}
          >
            <span className="text-sm leading-none">▣</span>
            {terminalOpen ? '터미널 숨기기' : '터미널 열기'}
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden bg-ink-900">
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
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
        active
          ? 'bg-ink-900 text-claude-300 shadow-soft'
          : 'text-ink-400 hover:text-white'
      }`}
    >
      <span className="font-medium">{label}</span>
      <kbd
        className={`hidden rounded px-1 text-[10px] sm:inline ${
          active ? 'bg-claude-500/15 text-claude-300/80' : 'bg-ink-800/60 text-ink-500'
        }`}
      >
        {shortcut}
      </kbd>
    </button>
  );
}
