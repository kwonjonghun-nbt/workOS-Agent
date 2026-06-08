import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jiraQueries, jiraMutations, jiraKeys } from '../../../../server-state/jira';
import {
  useRecentEpicsStore,
  MAX_RECENT_EPICS_PER_PROJECT,
} from '../../../../business/session-gate/recent-epics-store';
import { Field } from './Field';
import { EpicRow } from './EpicRow';
import { isEpicType, type Epic } from '../types';

type Props = {
  /** 에픽을 조회/생성할 프로젝트 키. */
  projectKey: string;
  /** 선택된 에픽(컨트롤드). */
  value: Epic | null;
  /** 선택/해제 시 호출. */
  onChange: (epic: Epic | null) => void;
  /** 필드 에러 메시지(예: 미선택 제출 시도). */
  error?: string;
};

/**
 * 에픽 선택 위젯 — value/onChange 로 동작하는 컨트롤드 컴포넌트.
 * 검색·최근 에픽·새 에픽 생성을 자체적으로 처리하고 선택 결과만 onChange 로 알린다.
 * 프로젝트가 바뀌면 부모에서 `key={projectKey}` 로 리마운트해 내부 상태를 초기화한다.
 */
export function EpicPicker({ projectKey, value, onChange, error }: Props) {
  const qc = useQueryClient();
  const epicsQuery = useQuery(jiraQueries.epics(projectKey));
  const typesQuery = useQuery(jiraQueries.issueTypes(projectKey));
  const createEpicM = useMutation(jiraMutations.createIssue());
  const addRecentEpic = useRecentEpicsStore((s) => s.add);
  const allRecentEpics = useRecentEpicsStore((s) => s.recent);

  const [epicText, setEpicText] = useState('');
  const [creating, setCreating] = useState(false);
  const [epicSummary, setEpicSummary] = useState('');
  const [createdEpics, setCreatedEpics] = useState<Epic[]>([]);

  // 새 에픽 생성에 쓸 Epic 이슈 타입.
  const epicType = useMemo(
    () => typesQuery.data?.issueTypes.find(isEpicType) ?? null,
    [typesQuery.data],
  );

  // 최근 에픽(현재 프로젝트, 최대 3).
  const recentEpics = useMemo(
    () =>
      allRecentEpics
        .filter((e) => e.projectKey === projectKey)
        .slice(0, MAX_RECENT_EPICS_PER_PROJECT),
    [allRecentEpics, projectKey],
  );

  // 서버 에픽 + 방금 만든 에픽 병합(검색 인덱스 지연 대비).
  const epics = useMemo(() => {
    const server = epicsQuery.data?.epics ?? [];
    const seen = new Set(server.map((e) => e.key));
    return [...createdEpics.filter((e) => !seen.has(e.key)), ...server];
  }, [epicsQuery.data, createdEpics]);

  const recentKeys = useMemo(() => new Set(recentEpics.map((e) => e.key)), [recentEpics]);
  const filteredEpics = useMemo(() => {
    const q = epicText.trim().toLowerCase();
    if (q) return epics.filter((e) => `${e.key} ${e.summary}`.toLowerCase().includes(q));
    return epics.filter((e) => !recentKeys.has(e.key));
  }, [epics, epicText, recentKeys]);

  const select = (epic: Epic) => {
    addRecentEpic({ ...epic, projectKey });
    onChange(epic);
  };

  const createEpic = async () => {
    if (!epicType || !projectKey || !epicSummary.trim()) return;
    const summary = epicSummary.trim();
    const created = await createEpicM.mutateAsync({ projectKey, issueTypeId: epicType.id, summary });
    const epic = { key: created.key, summary };
    setCreatedEpics((prev) => [epic, ...prev]);
    setEpicSummary('');
    setCreating(false);
    void qc.invalidateQueries({ queryKey: jiraKeys.epics(projectKey) });
    select(epic);
  };

  return (
    <Field label="에픽 (필수)" error={error}>
      {/* 1) 선택됨 */}
      {value && !creating && (
        <div className="flex items-center gap-2 rounded border border-claude-500/40 bg-claude-500/5 px-3 py-2">
          <span className="font-mono text-[11px] text-claude-300">{value.key}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-ink-100">{value.summary}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 rounded border border-ink-700 px-2 py-1 text-[11px] text-ink-300 hover:bg-ink-850"
          >
            변경
          </button>
        </div>
      )}

      {/* 2) 피커: 검색 + 최근 에픽 + 목록 + 새 에픽 */}
      {!value && !creating && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={epicText}
              onChange={(e) => setEpicText(e.target.value)}
              placeholder="에픽 검색 (키 또는 요약)"
              className="min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-claude-500"
            />
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={!epicType || typesQuery.isLoading}
              title={epicType ? '새 에픽 생성' : '이 프로젝트에서 Epic 타입을 찾지 못했습니다'}
              className="shrink-0 rounded border border-claude-500/40 px-2 py-1.5 text-xs text-claude-300 hover:bg-claude-500/10 disabled:opacity-40"
            >
              + 새 에픽
            </button>
          </div>

          {!epicType && !typesQuery.isLoading && typesQuery.data && (
            <p className="text-[11px] text-amber-300">
              이 프로젝트에서 Epic 이슈 타입을 찾지 못해 새 에픽을 만들 수 없습니다. 기존 에픽을
              선택하거나, Jira 프로젝트의 이슈 타입 설정을 확인하세요.
            </p>
          )}

          <div className="max-h-44 overflow-y-auto rounded border border-ink-800 p-1">
            {epicsQuery.isLoading && (
              <p className="px-2 py-1.5 text-xs text-ink-400">에픽 불러오는 중…</p>
            )}
            {epicsQuery.isError && (
              <p className="px-2 py-1.5 text-xs text-red-300">에픽을 불러오지 못했습니다.</p>
            )}

            {!epicText.trim() && recentEpics.length > 0 && (
              <>
                <p className="px-2 pt-1 text-[10px] uppercase tracking-wider text-ink-500">
                  최근 에픽
                </p>
                <ul className="space-y-0.5">
                  {recentEpics.map((e) => (
                    <li key={e.key}>
                      <EpicRow epic={e} recent onClick={() => select({ key: e.key, summary: e.summary })} />
                    </li>
                  ))}
                </ul>
                <div className="my-1 border-t border-ink-800" />
              </>
            )}

            {!epicsQuery.isLoading && filteredEpics.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-ink-400">
                {epicText.trim()
                  ? '검색 결과가 없습니다.'
                  : epics.length === 0
                    ? '에픽이 없습니다 — 새로 생성하세요.'
                    : ''}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {filteredEpics.map((e) => (
                  <li key={e.key}>
                    <EpicRow epic={e} onClick={() => select(e)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 3) 새 에픽 생성 인라인 폼 */}
      {creating && (
        <div className="space-y-2 rounded border border-claude-500/30 bg-claude-500/5 p-2">
          <input
            type="text"
            autoFocus
            placeholder="새 에픽 요약"
            value={epicSummary}
            onChange={(e) => setEpicSummary(e.target.value)}
            className="w-full rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-claude-500"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEpicSummary('');
              }}
              className="rounded border border-ink-700 px-2 py-1 text-[11px] text-ink-300 hover:bg-ink-850"
            >
              취소
            </button>
            <button
              type="button"
              disabled={createEpicM.isPending || !epicSummary.trim()}
              onClick={() => void createEpic()}
              className="rounded bg-claude-500/90 px-2 py-1 text-[11px] font-medium text-white hover:bg-claude-400 disabled:opacity-40"
            >
              {createEpicM.isPending ? '생성 중…' : '에픽 생성'}
            </button>
          </div>
          {createEpicM.error && (
            <p className="text-[11px] text-red-300">
              에픽 생성 실패: {(createEpicM.error as Error).message}
            </p>
          )}
        </div>
      )}
    </Field>
  );
}
