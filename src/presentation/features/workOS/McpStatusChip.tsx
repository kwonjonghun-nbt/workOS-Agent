import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mcpStatusQuery, mcpToolsQuery, mcpSetupMutation } from '../../../server-state/mcp';
import { toast } from '../../shared/toast-store';
import { preferencesApi, type SessionGateMode } from '../../../api/preferences';

type Props = { workspaceId: string };

export function McpStatusChip({ workspaceId }: Props) {
  const qc = useQueryClient();
  const status = useQuery(mcpStatusQuery(workspaceId));
  const tools = useQuery(mcpToolsQuery());
  const setup = useMutation({
    ...mcpSetupMutation(qc),
    onSuccess: (res) => {
      toast.success('MCP 설정 완료', res.actions.join(' · '));
    },
  });
  const [open, setOpen] = useState(false);

  // 세션 게이트 설정(전역 preference). 변경 시 즉시 저장하고, 워크스페이스 훅을
  // 다시 써넣기 위해 MCP 설정을 재실행한다.
  const [gateEnabled, setGateEnabled] = useState(
    () => preferencesApi.getSync().sessionGateHook !== false,
  );
  const [gateMode, setGateMode] = useState<SessionGateMode>(
    () => preferencesApi.getSync().sessionGateMode ?? 'always',
  );
  const applyGate = (enabled: boolean, mode: SessionGateMode) => {
    setGateEnabled(enabled);
    setGateMode(mode);
    void (async () => {
      await preferencesApi.setSessionGateHook(enabled);
      await preferencesApi.setSessionGateMode(mode);
      setup.mutate({ workspaceId, force: true });
    })();
  };

  const s = status.data;
  const ready = !!(s?.server.running && s?.workspace.configured && s?.workspace.sessionFresh);
  const label = !s
    ? 'MCP …'
    : !s.server.running
      ? 'MCP: 서버 중단'
      : !s.workspace.configured
        ? 'MCP: 미설정'
        : !s.workspace.sessionFresh
          ? 'MCP: 갱신 필요'
          : 'MCP: 연결됨';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="MCP 상태 / 설정"
        className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors ${
          ready
            ? 'bg-claude-500/10 text-claude-300 hover:bg-claude-500/20'
            : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
        }`}
      >
        <span className={`inline-block h-2 w-2 rounded-full ${ready ? 'bg-claude-400' : 'bg-amber-400'}`} />
        <span>{label}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-[420px] rounded border border-ink-700 bg-ink-900 p-3 text-sm shadow-2xl"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="mb-2 flex items-center justify-between">
            <strong className="text-ink-200">workos-agent MCP</strong>
            <button
              type="button"
              className="rounded bg-claude-600 px-2 py-0.5 text-xs text-white hover:bg-claude-500 disabled:opacity-50"
              disabled={setup.isPending}
              onClick={() => setup.mutate({ workspaceId, force: true })}
            >
              {setup.isPending ? '설정 중…' : '자동 설정 / 재설정'}
            </button>
          </div>
          <ul className="mb-3 space-y-0.5 text-xs text-ink-300">
            <li>
              제어 서버: {s?.server.running ? `127.0.0.1:${s.server.port}` : '중단됨'}
            </li>
            <li className="truncate" title={s?.server.scriptPath}>
              MCP 스크립트: <code className="text-ink-400">{s?.server.scriptPath}</code>
            </li>
            <li className="truncate" title={s?.workspace.configPath}>
              .mcp.json: <code className="text-ink-400">{s?.workspace.configPath}</code> {s?.workspace.configured ? '✓' : '✗'}
            </li>
            <li className="truncate" title={s?.workspace.sessionPath}>
              세션 파일: <code className="text-ink-400">{s?.workspace.sessionPath}</code> {s?.workspace.sessionFresh ? '✓' : '✗'}
            </li>
          </ul>
          <div className="mb-3 rounded border border-ink-800 bg-ink-850/40 p-2">
            <label className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-200">
                claude 세션 시작 시 Jira 게이트
              </span>
              <input
                type="checkbox"
                checked={gateEnabled}
                disabled={setup.isPending}
                onChange={(e) => applyGate(e.target.checked, gateMode)}
                className="h-3.5 w-3.5 accent-claude-500"
              />
            </label>
            <div className={`mt-2 space-y-1 ${gateEnabled ? '' : 'opacity-40'}`}>
              <label className="flex items-center gap-2 text-[11px] text-ink-300">
                <input
                  type="radio"
                  name="gateMode"
                  checked={gateMode === 'always'}
                  disabled={!gateEnabled || setup.isPending}
                  onChange={() => applyGate(gateEnabled, 'always')}
                  className="accent-claude-500"
                />
                항상 (실행마다 게이트 — <code className="text-ink-400">WORKOS_GATE=off claude</code> 로 그 실행만 끔)
              </label>
              <label className="flex items-center gap-2 text-[11px] text-ink-300">
                <input
                  type="radio"
                  name="gateMode"
                  checked={gateMode === 'flag'}
                  disabled={!gateEnabled || setup.isPending}
                  onChange={() => applyGate(gateEnabled, 'flag')}
                  className="accent-claude-500"
                />
                플래그일 때만 (<code className="text-ink-400">WORKOS_GATE=on claude</code> 로 켠 실행에서만)
              </label>
            </div>
            <p className="mt-1 text-[10px] text-ink-600">
              변경하면 이 워크스페이스의 SessionStart 훅을 다시 설정합니다.
            </p>
          </div>

          <div className="mb-1 text-xs font-semibold text-ink-300">노출 도구 ({tools.data?.length ?? 0})</div>
          <ul className="max-h-56 space-y-1 overflow-auto text-xs text-ink-400">
            {tools.data?.map((t) => (
              <li key={t.name} className="rounded bg-ink-850/60 px-2 py-1">
                <code className="text-claude-300">{t.name}</code> — {t.title}
                <div className="text-[11px] text-ink-500">{t.description}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
