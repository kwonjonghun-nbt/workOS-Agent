import { useState } from 'react';
import { jiraApi } from '../../../api/jira';
import type { TestConnectionResponse } from '../../../api/jira';

type State =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ok'; result: TestConnectionResponse; at: number }
  | { status: 'error'; message: string; at: number };

/**
 * Sanity-check the configured Jira settings: calls `/rest/api/3/myself` and
 * runs the search probe so the user can verify credentials + JQL before
 * relying on the task list view.
 */
export function JiraTestConnection() {
  const [state, setState] = useState<State>({ status: 'idle' });

  const run = async () => {
    setState({ status: 'pending' });
    console.log('[jira] testConnection: requesting…');
    try {
      const result = await jiraApi.testConnection();
      console.log('[jira] testConnection ok:', result);
      setState({ status: 'ok', result, at: Date.now() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[jira] testConnection failed:', err);
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
          <div className="font-semibold">연결 성공 · {new Date(state.at).toLocaleTimeString()}</div>
          <div className="mt-1 text-emerald-300/90">
            로그인 계정: <span className="text-emerald-200">{state.result.displayName}</span>
            {state.result.emailAddress ? ` (${state.result.emailAddress})` : ''}
          </div>
          <div className="text-emerald-300/90">
            Base URL: <span className="text-emerald-200">{state.result.baseUrl}</span>
          </div>
          <div className="text-emerald-300/90">
            프로젝트: <span className="text-emerald-200">{state.result.projectKeys.join(', ') || '(없음)'}</span>
          </div>
          <div className="text-emerald-300/90">
            현재 JQL 매치 이슈: <span className="text-emerald-200">{state.result.matchedIssues}</span> 건
            {state.result.matchedIssues === 0 && (
              <span className="ml-1 text-amber-300">
                — assignee=currentUser() 조건상 비어있을 수 있습니다.
              </span>
            )}
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
