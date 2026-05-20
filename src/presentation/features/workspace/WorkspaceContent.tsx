import { WorkOSShell } from '../workOS/WorkOSShell';

type Props = {
  workspaceId: string;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
};

export function WorkspaceContent({ workspaceId, terminalOpen, onToggleTerminal }: Props) {
  return (
    <WorkOSShell
      workspaceId={workspaceId}
      terminalOpen={terminalOpen}
      onToggleTerminal={onToggleTerminal}
    />
  );
}
