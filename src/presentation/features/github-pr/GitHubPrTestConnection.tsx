import { useState } from 'react';
import { githubPrApi, type GithubPrTestConnectionResponse } from '../../../api/github-pr';

type State =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ok'; result: GithubPrTestConnectionResponse; at: number }
  | { status: 'error'; message: string; at: number };

export function GitHubPrTestConnection() {
  const [state, setState] = useState<State>({ status: 'idle' });

  const run = async () => {
    setState({ status: 'pending' });
    try {
      const result = await githubPrApi.testConnection();
      setState({ status: 'ok', result, at: Date.now() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', message, at: Date.now() });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={state.status === 'pending'}
        className="self-start rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-850 disabled:opacity-50"
      >
        {state.status === 'pending' ? '연결 테스트 중…' : '🔌 연결 테스트'}
      </button>

      {state.status === 'ok' && (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-[11px] text-emerald-200">
          <div className="font-semibold">
            연결 성공 · {new Date(state.at).toLocaleTimeString()}
          </div>
          <div className="mt-1 text-emerald-300/90">
            로그인: <span className="text-emerald-200">{state.result.login}</span>
          </div>
          <div className="text-emerald-300/90">
            API URL: <span className="text-emerald-200">{state.result.apiUrl}</span>
          </div>
          <div className="text-emerald-300/90">
            레포: <span className="text-emerald-200">{state.result.repos.join(', ') || '(없음)'}</span>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-[11px] text-rose-300">
          <div className="font-semibold">연결 실패 · {new Date(state.at).toLocaleTimeString()}</div>
          <div className="mt-1 break-all">{state.message}</div>
        </div>
      )}
    </div>
  );
}
