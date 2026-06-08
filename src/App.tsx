import { WorkspaceShell } from './presentation/features/workspace/WorkspaceShell';
import { IssueDetailModal } from './presentation/features/jira/IssueDetailModal';
import { MacroAiBackgroundChip } from './presentation/features/macro-buttons/MacroAiBackgroundChip';
import { SessionGateModal } from './presentation/features/session-gate/SessionGateModal';

export default function App() {
  return (
    <>
      <WorkspaceShell />
      <IssueDetailModal />
      <MacroAiBackgroundChip />
      <SessionGateModal />
    </>
  );
}
