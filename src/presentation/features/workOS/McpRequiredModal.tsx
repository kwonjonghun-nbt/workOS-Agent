import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mcpSetupMutation, mcpStatusQuery } from '../../../server-state/mcp';
import { toast } from '../../shared/toast-store';

type Props = { workspaceId: string };

/**
 * 워크스페이스를 열었을 때 MCP가 연동되지 않았다면 자동으로 뜨는 게이트 모달.
 * MCP는 이 서비스의 필수 의존성이라(터미널 에이전트의 tool 호출 통로) 준비가 안 된 상태에서는
 * 작업을 시작하지 못하도록 막고, 한 번의 클릭으로 자동 설정할 수 있게 한다.
 *
 * 사용자가 "나중에"를 누르면 같은 세션 동안엔 다시 뜨지 않는다(작업 흐름을 강제로 막지는 않음).
 * 모달이 닫혀도 상단 `McpStatusChip`으로 언제든 재설정 가능.
 */
export function McpRequiredModal({ workspaceId }: Props) {
  const qc = useQueryClient();
  const status = useQuery(mcpStatusQuery(workspaceId));
  const baseSetup = mcpSetupMutation(qc);
  const setup = useMutation({
    ...baseSetup,
    onSuccess: (res, vars, ctx) => {
      baseSetup.onSuccess(res, vars);
      toast.success('MCP 연동 완료', res.actions.join(' · '));
      void ctx;
    },
  });

  const [dismissed, setDismissed] = useState(false);

  const s = status.data;
  const ready = !!(s?.server.running && s?.workspace.configured && s?.workspace.sessionFresh);

  // 준비되면 dismissed 플래그도 리셋(이후 다시 상태가 깨지면 또 떠야 함).
  useEffect(() => {
    if (ready && dismissed) setDismissed(false);
  }, [ready, dismissed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDismissed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!s || ready || dismissed) return null;

  const reason = !s.server.running
    ? { title: 'MCP 제어 서버가 실행 중이지 않습니다.', detail: '앱을 재시작해 주세요.' }
    : !s.workspace.configured
      ? {
          title: '이 워크스페이스에 MCP 서버가 등록돼 있지 않습니다.',
          detail:
            '“자동 설정”을 누르면 워크스페이스 루트의 .mcp.json 에 workos-agent MCP 서버가 추가됩니다.',
        }
      : {
          title: 'MCP 세션 토큰이 만료/불일치 상태입니다.',
          detail:
            '앱을 재시작하면 포트/토큰이 회전합니다. “자동 설정”을 누르면 세션 사이드카가 갱신됩니다.',
        };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-amber-500/40 bg-ink-900 shadow-2xl">
        <header className="flex items-center gap-2 border-b border-ink-850 px-5 py-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
          <h2 className="text-base font-semibold text-white">MCP 연동이 필요합니다</h2>
        </header>

        <div className="space-y-3 px-5 py-4 text-sm">
          <p className="text-ink-200">
            이 워크스페이스에서 작업을 시작하려면 <strong>workos-agent MCP</strong> 연동이 필요합니다.
            연동이 되어야 터미널 에이전트가 TaskItem 진행/완료 같은 작업 도구를 호출할 수 있습니다.
          </p>

          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="mb-1 font-semibold text-amber-300">{reason.title}</div>
            <p className="text-xs text-ink-300">{reason.detail}</p>
          </div>

          <ul className="space-y-0.5 text-[11px] text-ink-400">
            <li>
              제어 서버:{' '}
              {s.server.running ? (
                <span className="text-claude-300">127.0.0.1:{s.server.port}</span>
              ) : (
                <span className="text-red-300">중단됨</span>
              )}
            </li>
            <li className="truncate" title={s.workspace.configPath}>
              .mcp.json: <code className="text-ink-500">{s.workspace.configPath}</code>{' '}
              {s.workspace.configured ? '✓' : '✗'}
            </li>
            <li className="truncate" title={s.workspace.sessionPath}>
              세션 파일: <code className="text-ink-500">{s.workspace.sessionPath}</code>{' '}
              {s.workspace.sessionFresh ? '✓' : '✗'}
            </li>
          </ul>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-ink-850 bg-ink-900/60 px-5 py-3">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-850"
            title="이번 세션 동안 다시 띄우지 않습니다. 상단 MCP 칩에서 언제든 재설정할 수 있습니다."
          >
            나중에
          </button>
          <button
            type="button"
            disabled={setup.isPending || !s.server.running}
            onClick={() => setup.mutate({ workspaceId, force: true })}
            className="rounded bg-claude-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-claude-400 disabled:opacity-40"
          >
            {setup.isPending ? '설정 중…' : 'MCP 자동 설정'}
          </button>
        </footer>
      </div>
    </div>
  );
}
