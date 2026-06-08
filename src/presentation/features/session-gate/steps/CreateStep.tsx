import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jiraQueries } from '../../../../server-state/jira';
import { Field } from '../components/Field';
import { Footer } from '../components/Footer';
import { Reveal } from '../components/Reveal';
import { EpicPicker } from '../components/EpicPicker';
import { isEpicType, type CreateSubmit, type Epic } from '../types';

/**
 * "새 Jira 티켓 생성" 스텝. 프로젝트→에픽→이슈타입→요약→설명 순으로 순차 공개되고,
 * 에픽 선택은 {@link EpicPicker} 에 위임한다. 폼 상태는 순수 React state.
 */
export function CreateStep({
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  submitting: boolean;
  error: Error | null;
  onBack: () => void;
  onSubmit: (form: CreateSubmit) => void;
}) {
  const [projectKey, setProjectKey] = useState('');
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
  const [issueTypeId, setIssueTypeId] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [attempted, setAttempted] = useState(false);

  const projectsQuery = useQuery(jiraQueries.projects());
  const typesQuery = useQuery(jiraQueries.issueTypes(projectKey));

  // 기본 프로젝트 = 설정된 첫 프로젝트
  useEffect(() => {
    const projects = projectsQuery.data?.projects ?? [];
    if (!projectKey && projects.length > 0) setProjectKey(projects[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsQuery.data]);

  // 메인 티켓 이슈 타입(에픽 제외)
  const standardTypes = useMemo(
    () => typesQuery.data?.issueTypes.filter((t) => !isEpicType(t)) ?? [],
    [typesQuery.data],
  );

  // 기본 이슈 타입 = 첫 비에픽 타입(현재 선택이 목록에 없으면 교체)
  useEffect(() => {
    if (standardTypes.length === 0) return;
    setIssueTypeId((cur) => (standardTypes.some((t) => t.id === cur) ? cur : standardTypes[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typesQuery.data]);

  // 프로젝트 변경 시 하위 선택 초기화(EpicPicker 는 key={projectKey} 로 함께 리마운트)
  const changeProject = (key: string) => {
    setProjectKey(key);
    setSelectedEpic(null);
    setIssueTypeId('');
  };

  // 순차 공개
  const showEpic = projectKey.trim().length > 0;
  const showType = showEpic && selectedEpic !== null;
  const showSummary = showType && issueTypeId.trim().length > 0;
  const showFinish = showSummary && summary.trim().length > 0;
  const epicMissing = attempted && !selectedEpic;

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!projectKey || !selectedEpic || !issueTypeId || !summary.trim()) return;
    onSubmit({
      projectKey,
      issueTypeId,
      summary: summary.trim(),
      descriptionMarkdown: description.trim() || undefined,
      parentKey: selectedEpic.key,
    });
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-3 px-5 py-4">
      <Field label="프로젝트">
        <select
          value={projectKey}
          onChange={(e) => changeProject(e.target.value)}
          disabled={projectsQuery.isLoading}
          className="w-full rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-claude-500 disabled:opacity-50"
        >
          {projectsQuery.isLoading && <option value="">불러오는 중…</option>}
          {!projectsQuery.isLoading && (projectsQuery.data?.projects.length ?? 0) === 0 && (
            <option value="">프로젝트 없음 — Jira 설정의 프로젝트 키를 확인하세요</option>
          )}
          {projectsQuery.data?.projects.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name && p.name !== p.key ? `${p.key} — ${p.name}` : p.key}
            </option>
          ))}
        </select>
        {projectsQuery.isError && (
          <p className="mt-1 text-[11px] text-red-300">
            프로젝트 목록을 불러오지 못했습니다. Jira 설정을 확인하세요.
          </p>
        )}
      </Field>

      <Reveal show={showEpic}>
        <EpicPicker
          key={projectKey}
          projectKey={projectKey}
          value={selectedEpic}
          onChange={setSelectedEpic}
          error={epicMissing ? '에픽을 선택하거나 생성하세요' : undefined}
        />
      </Reveal>

      <Reveal show={showType}>
        <Field label="이슈 타입">
          <select
            value={issueTypeId}
            onChange={(e) => setIssueTypeId(e.target.value)}
            disabled={typesQuery.isLoading || standardTypes.length === 0}
            className="w-full rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-claude-500 disabled:opacity-50"
          >
            {typesQuery.isLoading && <option value="">불러오는 중…</option>}
            {standardTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {typesQuery.isError && (
            <p className="mt-1 text-[11px] text-red-300">
              이슈 타입을 불러오지 못했습니다. 프로젝트 키와 Jira 설정을 확인하세요.
            </p>
          )}
        </Field>
      </Reveal>

      <Reveal show={showSummary}>
        <Field label="요약" error={attempted && !summary.trim() ? '요약을 입력하세요' : undefined}>
          <input
            type="text"
            placeholder="티켓 제목"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-claude-500"
          />
        </Field>
      </Reveal>

      <Reveal show={showFinish}>
        <Field label="설명 (선택, 마크다운)">
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-claude-500"
          />
        </Field>
      </Reveal>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-300">
          생성 실패: {error.message}
        </div>
      )}

      <Footer onBack={onBack} submitting={submitting}>
        {showFinish && (
          <Reveal show={showFinish}>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-claude-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-claude-400 disabled:opacity-40"
            >
              {submitting ? '생성 중…' : '생성하고 시작'}
            </button>
          </Reveal>
        )}
      </Footer>
    </form>
  );
}
