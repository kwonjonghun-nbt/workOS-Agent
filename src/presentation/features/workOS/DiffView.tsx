import { useState } from 'react';
import { useGitCommit, useGitDiff } from '../../../business/workOS/use-workOS';
import { toast } from '../../shared/toast-store';

type Props = { workspaceId: string };

export function DiffView({ workspaceId }: Props) {
  const diff = useGitDiff(workspaceId);
  const commit = useGitCommit();
  const [message, setMessage] = useState('');

  const handleCommit = async () => {
    const m = message.trim();
    if (!m) return;
    try {
      const res = await commit.mutateAsync({ workspaceId, message: m });
      setMessage('');
      await diff.refetch();
      toast.success('커밋 완료', `${res.commitSha.slice(0, 7)} — ${m}`);
    } catch {
      /* mutation cache toasts the error */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-800 p-3">
        <button
          type="button"
          onClick={() => void diff.refetch()}
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          🔄 새로고침
        </button>
        <div className="text-sm text-slate-400">
          {diff.isFetching
            ? '읽는 중…'
            : diff.data
              ? `${diff.data.changedFiles.length}개 파일 변경됨`
              : 'git 정보 없음'}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr]">
        <aside className="overflow-y-auto border-r border-slate-800 bg-slate-900/40 p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            변경 파일
          </div>
          <ul className="space-y-0.5">
            {(diff.data?.changedFiles ?? []).map((f) => (
              <li
                key={f}
                className="truncate rounded px-2 py-1 font-mono text-xs text-slate-300 hover:bg-slate-800"
                title={f}
              >
                {f}
              </li>
            ))}
            {diff.data && diff.data.changedFiles.length === 0 && (
              <li className="px-2 py-2 text-xs text-slate-500">변경 없음</li>
            )}
          </ul>
        </aside>
        <pre className="m-0 overflow-auto whitespace-pre bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200">
          {colorizeDiff(diff.data?.diff ?? '')}
        </pre>
      </div>
      <div className="border-t border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          커밋 메시지
        </div>
        <div className="flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="예) feat: 결제 페이지 추가"
            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCommit();
            }}
          />
          <button
            type="button"
            onClick={() => void handleCommit()}
            disabled={!message.trim() || !diff.data?.hasChanges || commit.isPending}
            className="rounded bg-emerald-500/90 px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-emerald-400 disabled:opacity-40"
            title="커밋 (Enter)"
          >
            {commit.isPending ? '커밋 중…' : '커밋'}
          </button>
        </div>
        {!diff.data?.hasChanges && (
          <p className="mt-1 text-xs text-slate-500">변경된 파일이 없으면 커밋할 수 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function colorizeDiff(diff: string): JSX.Element[] {
  if (!diff) return [<span key="empty" className="text-slate-500">— diff 없음 —</span>];
  return diff.split('\n').map((line, i) => {
    let cls = 'text-slate-300';
    if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-emerald-400';
    else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-red-400';
    else if (line.startsWith('@@')) cls = 'text-sky-400';
    else if (line.startsWith('diff ') || line.startsWith('index '))
      cls = 'text-amber-300';
    return (
      <span key={i} className={cls}>
        {line}
        {'\n'}
      </span>
    );
  });
}
