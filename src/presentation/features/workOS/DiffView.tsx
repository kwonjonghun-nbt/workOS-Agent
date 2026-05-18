import { useEffect, useMemo, useState } from 'react';
import {
  useGitCommit,
  useGitFileDiff,
  useGitStagePaths,
  useGitStatus,
  useGitUnstagePaths,
} from '../../../business/workOS/use-workOS';
import type { FileChange } from '../../../api/workOS';
import { toast } from '../../shared/toast-store';

type Props = { workspaceId: string };
type Side = 'staged' | 'unstaged';

type SelectedTarget = { path: string; side: Side } | null;

export function DiffView({ workspaceId }: Props) {
  const status = useGitStatus(workspaceId);
  const stage = useGitStagePaths();
  const unstage = useGitUnstagePaths();
  const commit = useGitCommit();
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<SelectedTarget>(null);

  const { staged, unstaged } = useMemo(() => splitFiles(status.data?.files ?? []), [status.data]);

  // 선택된 파일이 사라지면 자동 해제
  useEffect(() => {
    if (!selected) return;
    const exists = (selected.side === 'staged' ? staged : unstaged).some(
      (f) => f.path === selected.path,
    );
    if (!exists) setSelected(null);
  }, [staged, unstaged, selected]);

  const hasStaged = staged.length > 0;

  const handleCommit = async () => {
    const m = message.trim();
    if (!m) return;
    if (!hasStaged) {
      toast.warning('스테이지된 파일이 없습니다', '커밋할 파일을 먼저 stage 해주세요.');
      return;
    }
    try {
      const res = await commit.mutateAsync({ workspaceId, message: m });
      setMessage('');
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
          onClick={() => void status.refetch()}
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          🔄 새로고침
        </button>
        <div className="text-sm text-slate-400">
          {status.isFetching
            ? '읽는 중…'
            : status.data
              ? `${status.data.files.length}개 파일 — staged ${staged.length} / unstaged ${unstaged.length}`
              : 'git 정보 없음'}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr]">
        <aside className="overflow-y-auto border-r border-slate-800 bg-slate-900/40">
          <FileSection
            title="Staged (커밋 대상)"
            files={staged}
            side="staged"
            selected={selected}
            onSelect={(t) => setSelected(t)}
            onToggle={(file) =>
              void unstage.mutateAsync({ workspaceId, paths: targetPaths(file) })
            }
            actionLabel="Unstage"
            empty="스테이지된 파일이 없습니다."
            disabled={unstage.isPending}
            allActionLabel={hasStaged ? '전체 Unstage' : undefined}
            onAllAction={() =>
              hasStaged &&
              void unstage.mutateAsync({
                workspaceId,
                paths: staged.flatMap((f) => targetPaths(f)),
              })
            }
          />
          <FileSection
            title="Unstaged"
            files={unstaged}
            side="unstaged"
            selected={selected}
            onSelect={(t) => setSelected(t)}
            onToggle={(file) =>
              void stage.mutateAsync({ workspaceId, paths: targetPaths(file) })
            }
            actionLabel="Stage"
            empty="변경 없음."
            disabled={stage.isPending}
            allActionLabel={unstaged.length > 0 ? '전체 Stage' : undefined}
            onAllAction={() =>
              unstaged.length > 0 &&
              void stage.mutateAsync({
                workspaceId,
                paths: unstaged.flatMap((f) => targetPaths(f)),
              })
            }
          />
        </aside>
        <DiffPane workspaceId={workspaceId} target={selected} />
      </div>
      <div className="border-t border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-400">커밋 메시지</span>
          <span className={`${hasStaged ? 'text-emerald-300' : 'text-amber-400'}`}>
            {hasStaged ? `staged ${staged.length}개 커밋 가능` : '⚠ 스테이지된 파일 없음'}
          </span>
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
            disabled={!message.trim() || !hasStaged || commit.isPending}
            className="rounded bg-emerald-500/90 px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-emerald-400 disabled:opacity-40"
            title="staged 파일만 커밋 (Enter)"
          >
            {commit.isPending ? '커밋 중…' : '커밋'}
          </button>
        </div>
      </div>
    </div>
  );
}

function splitFiles(files: FileChange[]): { staged: FileChange[]; unstaged: FileChange[] } {
  const staged: FileChange[] = [];
  const unstaged: FileChange[] = [];
  for (const f of files) {
    if (f.staged) staged.push(f);
    if (f.unstaged) unstaged.push(f);
  }
  staged.sort((a, b) => a.path.localeCompare(b.path));
  unstaged.sort((a, b) => a.path.localeCompare(b.path));
  return { staged, unstaged };
}

function targetPaths(file: FileChange): string[] {
  return file.oldPath && file.kind === 'renamed' ? [file.oldPath, file.path] : [file.path];
}

function FileSection({
  title,
  files,
  side,
  selected,
  onSelect,
  onToggle,
  actionLabel,
  empty,
  disabled,
  allActionLabel,
  onAllAction,
}: {
  title: string;
  files: FileChange[];
  side: Side;
  selected: SelectedTarget;
  onSelect: (t: SelectedTarget) => void;
  onToggle: (f: FileChange) => void;
  actionLabel: string;
  empty: string;
  disabled: boolean;
  allActionLabel?: string;
  onAllAction?: () => void;
}) {
  return (
    <section className="border-b border-slate-800">
      <div className="flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <span>
          {title} <span className="ml-1 text-slate-600">({files.length})</span>
        </span>
        {allActionLabel && onAllAction && (
          <button
            type="button"
            disabled={disabled}
            onClick={onAllAction}
            className="rounded px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            {allActionLabel}
          </button>
        )}
      </div>
      <ul className="space-y-0.5 px-1 pb-2">
        {files.map((f) => {
          const active = selected?.side === side && selected.path === f.path;
          return (
            <li key={`${side}-${f.path}`}>
              <div
                className={`group flex items-center gap-1 rounded px-1.5 py-1 text-xs ${
                  active ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect({ path: f.path, side })}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  <KindBadge kind={f.kind} />
                  <span className="truncate font-mono" title={f.path}>
                    {f.kind === 'renamed' && f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggle(f)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-slate-300 opacity-0 hover:bg-slate-700 group-hover:opacity-100 disabled:opacity-30"
                  title={actionLabel}
                >
                  {actionLabel}
                </button>
              </div>
            </li>
          );
        })}
        {files.length === 0 && (
          <li className="px-2 py-2 text-[11px] text-slate-500">{empty}</li>
        )}
      </ul>
    </section>
  );
}

function KindBadge({ kind }: { kind: FileChange['kind'] }) {
  const map: Record<FileChange['kind'], { label: string; cls: string }> = {
    added: { label: 'A', cls: 'bg-emerald-500/20 text-emerald-300' },
    modified: { label: 'M', cls: 'bg-amber-500/20 text-amber-300' },
    deleted: { label: 'D', cls: 'bg-red-500/20 text-red-300' },
    renamed: { label: 'R', cls: 'bg-sky-500/20 text-sky-300' },
    untracked: { label: 'U', cls: 'bg-violet-500/20 text-violet-300' },
    unknown: { label: '?', cls: 'bg-slate-700 text-slate-300' },
  };
  const v = map[kind];
  return (
    <span
      className={`inline-block w-4 shrink-0 rounded text-center font-mono text-[10px] ${v.cls}`}
      title={kind}
    >
      {v.label}
    </span>
  );
}

function DiffPane({
  workspaceId,
  target,
}: {
  workspaceId: string;
  target: SelectedTarget;
}) {
  const diff = useGitFileDiff(workspaceId, target?.path ?? null, target?.side ?? 'unstaged');

  if (!target) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 p-6 text-sm text-slate-500">
        왼쪽에서 파일을 선택하면 해당 변경의 diff 가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs">
        <span
          className={`rounded px-1.5 py-0.5 ${
            target.side === 'staged'
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-amber-500/15 text-amber-300'
          }`}
        >
          {target.side === 'staged' ? 'staged diff' : 'unstaged diff'}
        </span>
        <span className="truncate font-mono text-slate-300" title={target.path}>
          {target.path}
        </span>
      </div>
      <pre className="m-0 flex-1 overflow-auto whitespace-pre bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200">
        {diff.isFetching && !diff.data ? (
          <span className="text-slate-500">로딩 중…</span>
        ) : diff.data?.isBinary ? (
          <span className="text-slate-500">바이너리 파일 — diff 표시 불가</span>
        ) : (
          colorizeDiff(diff.data?.diff ?? '')
        )}
      </pre>
    </div>
  );
}

function colorizeDiff(diff: string): JSX.Element[] {
  if (!diff) return [<span key="empty" className="text-slate-500">— 변경 없음 —</span>];
  return diff.split('\n').map((line, i) => {
    let cls = 'text-slate-300';
    if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-emerald-400';
    else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-red-400';
    else if (line.startsWith('@@')) cls = 'text-sky-400';
    else if (line.startsWith('diff ') || line.startsWith('index ')) cls = 'text-amber-300';
    return (
      <span key={i} className={cls}>
        {line}
        {'\n'}
      </span>
    );
  });
}
