import { WorkspaceShell } from './presentation/features/workspace/WorkspaceShell';
import { IssueDetailModal } from './presentation/features/jira/IssueDetailModal';

export default function App() {
  return (
    <>
      <WorkspaceShell />
      <IssueDetailModal />
    </>
  );
}
