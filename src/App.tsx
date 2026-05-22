import { WorkspaceShell } from './presentation/features/workspace/WorkspaceShell';
import { IssueDetailModal } from './presentation/features/jira/IssueDetailModal';
import { MacroAiBackgroundChip } from './presentation/features/macro-buttons/MacroAiBackgroundChip';

export default function App() {
  return (
    <>
      <WorkspaceShell />
      <IssueDetailModal />
      <MacroAiBackgroundChip />
    </>
  );
}
