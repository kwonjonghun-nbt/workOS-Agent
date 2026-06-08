import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { jiraQueries } from '../../../../server-state/jira';
import { Field } from '../components/Field';
import { Footer } from '../components/Footer';
import { Reveal } from '../components/Reveal';
import { EpicPicker } from '../components/EpicPicker';
import { isEpicType, type CreateSubmit } from '../types';

// 에픽(parentKey)은 커스텀 picker 라 Epic 객체를 폼 값으로 들고, 제출 시 key 만 뽑는다.
// nullable 로 두고(필수 검증은 submit 에서 setError), refine 으로 타입을 좁히지 않는다
// — 좁히면 z.input ≠ z.output 이 되어 RHF defaultValues 타입과 충돌한다.
const createSchema = z.object({
  projectKey: z.string().min(1, '프로젝트를 선택하세요'),
  epic: z.object({ key: z.string(), summary: z.string() }).nullable(),
  issueTypeId: z.string().min(1, '이슈 타입을 선택하세요'),
  summary: z.string().trim().min(1, '요약을 입력하세요').max(255),
  descriptionMarkdown: z.string().optional(),
});
type CreateFormValues = z.infer<typeof createSchema>;

/**
 * "새 Jira 티켓 생성" 스텝. react-hook-form + zod 로 폼을 관리하고, 에픽은
 * {@link EpicPicker}(컨트롤드)를 Controller 로 연결한다. 프로젝트→에픽→이슈타입→
 * 요약→설명 순으로 순차 공개된다.
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
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      projectKey: '',
      epic: null,
      issueTypeId: '',
      summary: '',
      descriptionMarkdown: '',
    },
  });

  const projectKey = watch('projectKey');
  const epic = watch('epic');
  const issueTypeId = watch('issueTypeId');
  const summary = watch('summary');

  const projectsQuery = useQuery(jiraQueries.projects());
  const typesQuery = useQuery(jiraQueries.issueTypes(projectKey));

  // 기본 프로젝트 = 설정된 첫 프로젝트(프로그램적 setValue 라 onChange 리셋은 안 탄다)
  useEffect(() => {
    const projects = projectsQuery.data?.projects ?? [];
    if (!projectKey && projects.length > 0) setValue('projectKey', projects[0].key);
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
    const cur = watch('issueTypeId');
    if (!standardTypes.some((t) => t.id === cur)) setValue('issueTypeId', standardTypes[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typesQuery.data]);

  // 순차 공개
  const showEpic = projectKey.trim().length > 0;
  const showType = showEpic && epic !== null;
  const showSummary = showType && issueTypeId.trim().length > 0;
  const showFinish = showSummary && summary.trim().length > 0;

  const submit = handleSubmit((data) => {
    if (!data.epic) {
      setError('epic', { message: '에픽을 선택하거나 생성하세요' });
      return;
    }
    onSubmit({
      projectKey: data.projectKey,
      issueTypeId: data.issueTypeId,
      issueTypeName: standardTypes.find((t) => t.id === data.issueTypeId)?.name ?? '',
      summary: data.summary.trim(),
      descriptionMarkdown: data.descriptionMarkdown?.trim() || undefined,
      parentKey: data.epic.key,
    });
  });

  return (
    <form onSubmit={submit} className="space-y-3 px-5 py-4">
      <Field label="프로젝트" error={errors.projectKey?.message}>
        <select
          {...register('projectKey', {
            // 프로젝트가 바뀌면 하위 선택 초기화
            onChange: () => {
              setValue('epic', null, { shouldValidate: false });
              setValue('issueTypeId', '');
            },
          })}
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
        <Controller
          name="epic"
          control={control}
          render={({ field, fieldState }) => (
            <EpicPicker
              key={projectKey}
              projectKey={projectKey}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      </Reveal>

      <Reveal show={showType}>
        <Field label="이슈 타입" error={errors.issueTypeId?.message}>
          <select
            {...register('issueTypeId')}
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
        <Field label="요약" error={errors.summary?.message}>
          <input
            type="text"
            placeholder="티켓 제목"
            {...register('summary')}
            className="w-full rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-claude-500"
          />
        </Field>
      </Reveal>

      <Reveal show={showFinish}>
        <Field label="설명 (선택, 마크다운)">
          <textarea
            rows={3}
            {...register('descriptionMarkdown')}
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
