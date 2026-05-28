import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jiraQueries } from '../../../server-state/jira';
import { useUpdateExtensionSettings } from '../../../business/extension/use-extensions';

const JIRA_EXTENSION_ID = 'workos.jira';

const TASK_ITEM_STATUSES = [
  'pending',
  'running',
  'in_progress',
  'completed',
  'failed',
  'skipped',
] as const;

type TaskItemStatus = (typeof TASK_ITEM_STATUSES)[number];

type TransitionEntry = { id: string; name: string; toStatus?: string };
type MappingRow = { status: TaskItemStatus; entry: TransitionEntry | null };

function parseMapping(json: string): Record<string, TransitionEntry> {
  if (!json.trim()) return {};
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const out: Record<string, TransitionEntry> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.trim()) {
        out[k] = { id: '', name: v };
      } else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const id = typeof o.id === 'string' ? o.id : '';
        const name = typeof o.name === 'string' ? o.name : '';
        const toStatus = typeof o.toStatus === 'string' ? o.toStatus : undefined;
        if (id || name) out[k] = { id, name, toStatus };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function serializeMapping(rows: MappingRow[]): string {
  const out: Record<string, TransitionEntry> = {};
  for (const row of rows) {
    if (row.entry && (row.entry.id || row.entry.name)) {
      out[row.status] = row.entry;
    }
  }
  return JSON.stringify(out);
}

/**
 * Jira 확장 설정의 statusTransitions 를 키-값 UI로 편집.
 * sampleIssueKey 로 transitions 를 불러와 셀렉트박스로 선택 가능.
 */
export function JiraTransitionMapEditor({
  currentJson,
}: {
  currentJson: string;
}) {
  const updateSettings = useUpdateExtensionSettings();
  const [sampleIssueKey, setSampleIssueKey] = useState('');
  const [fetchKey, setFetchKey] = useState('');
  const [rows, setRows] = useState<MappingRow[]>(() => {
    const existing = parseMapping(currentJson);
    return TASK_ITEM_STATUSES.map((status) => ({
      status,
      entry: existing[status] ?? null,
    }));
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const transitionsQuery = useQuery({
    ...jiraQueries.transitions(fetchKey),
    enabled: !!fetchKey,
  });

  const transitions = transitionsQuery.data?.transitions ?? [];

  const handleFetch = () => {
    const key = sampleIssueKey.trim().toUpperCase();
    if (key) setFetchKey(key);
  };

  const handleSelect = (status: TaskItemStatus, transitionId: string) => {
    const t = transitions.find((tr) => tr.id === transitionId);
    setRows((prev) =>
      prev.map((r) =>
        r.status === status
          ? { ...r, entry: t ? { id: t.id, name: t.name, toStatus: t.to } : null }
          : r,
      ),
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(JIRA_EXTENSION_ID, {
        statusTransitions: serializeMapping(rows),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold text-ink-200">상태 전환 매핑 편집기</div>
      <p className="text-[11px] text-ink-400">
        TaskItem 상태 변경 시 Jira 에 자동으로 transition 을 요청합니다. 샘플 이슈 키를 입력하고
        "불러오기"를 누르면 해당 이슈의 transition 목록을 셀렉트박스로 선택할 수 있습니다.
      </p>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={sampleIssueKey}
          onChange={(e) => setSampleIssueKey(e.target.value)}
          placeholder="샘플 이슈 키 (예: PROJ-1)"
          className="w-40 rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-200 placeholder:text-ink-600 focus:outline-none focus:ring-1 focus:ring-claude-500"
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={!sampleIssueKey.trim() || transitionsQuery.isFetching}
          className="rounded border border-ink-700 px-2.5 py-1 text-xs text-ink-200 hover:bg-ink-850 disabled:opacity-50"
        >
          {transitionsQuery.isFetching ? '불러오는 중…' : 'Transitions 불러오기'}
        </button>
        {transitionsQuery.isError && (
          <span className="text-[11px] text-rose-400">불러오기 실패</span>
        )}
        {transitions.length > 0 && (
          <span className="text-[11px] text-emerald-400">{transitions.length}개 로드됨</span>
        )}
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-ink-800">
            <th className="py-1.5 pr-3 text-left font-medium text-ink-400">TaskItem 상태</th>
            <th className="py-1.5 text-left font-medium text-ink-400">Jira Transition</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.status} className="border-b border-ink-850/60">
              <td className="py-1.5 pr-3 font-mono text-ink-300">{row.status}</td>
              <td className="py-1.5">
                {transitions.length > 0 ? (
                  <select
                    value={row.entry?.id ?? ''}
                    onChange={(e) => handleSelect(row.status, e.target.value)}
                    className="w-full rounded border border-ink-700 bg-ink-900 px-2 py-0.5 text-xs text-ink-200 focus:outline-none focus:ring-1 focus:ring-claude-500"
                  >
                    <option value="">(매핑 없음)</option>
                    {transitions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} → {t.to}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-ink-500">
                    {row.entry ? `${row.entry.name}${row.entry.id ? ` (id: ${row.entry.id})` : ''}` : '(없음)'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded bg-claude-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-claude-400 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        {saved && <span className="text-[11px] text-emerald-400">저장 완료</span>}
      </div>
    </div>
  );
}
