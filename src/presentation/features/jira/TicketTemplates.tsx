import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  jiraTemplateMutations,
  jiraTemplateQueries,
  jiraTemplateKeys,
} from '../../../server-state/jira/templates';
import type {
  TemplateKind,
  TemplateSection,
  TicketTemplate,
} from '../../../api/jira/template';

const KIND_TABS: { key: TemplateKind; label: string; hint: string }[] = [
  { key: 'task', label: '티켓 템플릿', hint: '에픽이 아닌 일반 티켓용 본문 구성' },
  { key: 'epic', label: '에픽 템플릿', hint: '에픽 본문 구성 (Wiki/Figma 링크 필수)' },
];

export function TicketTemplates() {
  const [kind, setKind] = useState<TemplateKind>('task');
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded border border-ink-800 bg-ink-900/50 p-3 text-xs leading-relaxed text-ink-300">
        지라 본문이 어떤 섹션으로 구성되어야 하는지 정의합니다. 이 템플릿은
        "내용 검토 / 추천" 메뉴에서 LLM 에게 검토 기준으로 전달됩니다.
        에픽은 위키 문서 / Figma 링크 섹션이 기본 포함됩니다.
      </div>

      <div className="flex items-center gap-1 self-start rounded border border-ink-800 bg-ink-900/60 p-0.5">
        {KIND_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setKind(t.key)}
            title={t.hint}
            className={`rounded px-2.5 py-1 text-xs ${
              kind === t.key
                ? 'bg-ink-800 text-ink-100'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <TemplateEditor kind={kind} />
    </div>
  );
}

function TemplateEditor({ kind }: { kind: TemplateKind }) {
  const qc = useQueryClient();
  const query = useQuery(jiraTemplateQueries.detail(kind));
  const saveMutation = useMutation(jiraTemplateMutations.save());
  const resetMutation = useMutation(jiraTemplateMutations.reset());

  const [draft, setDraft] = useState<TicketTemplate | null>(null);

  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data, kind]);

  const dirty = useMemo(() => {
    if (!draft || !query.data) return false;
    return JSON.stringify(draft) !== JSON.stringify(query.data);
  }, [draft, query.data]);

  if (query.isLoading) {
    return <div className="text-xs text-ink-400">로딩 중...</div>;
  }
  if (query.error || !draft) {
    return (
      <div className="text-xs text-red-400">
        템플릿 로드 실패: {String(query.error)}
      </div>
    );
  }

  const onChangeSection = (index: number, patch: Partial<TemplateSection>) => {
    setDraft((cur) => {
      if (!cur) return cur;
      const sections = cur.sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...cur, sections };
    });
  };

  const onAddSection = () => {
    setDraft((cur) =>
      cur
        ? {
            ...cur,
            sections: [
              ...cur.sections,
              {
                key: `section-${cur.sections.length + 1}`,
                title: '새 섹션',
                description: '',
                required: false,
                hint: '',
              },
            ],
          }
        : cur,
    );
  };

  const onRemoveSection = (index: number) => {
    setDraft((cur) =>
      cur
        ? { ...cur, sections: cur.sections.filter((_, i) => i !== index) }
        : cur,
    );
  };

  const onMove = (index: number, dir: -1 | 1) => {
    setDraft((cur) => {
      if (!cur) return cur;
      const next = [...cur.sections];
      const target = index + dir;
      if (target < 0 || target >= next.length) return cur;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...cur, sections: next };
    });
  };

  const onSave = () => {
    if (!draft) return;
    saveMutation.mutate(
      { kind: draft.kind, name: draft.name, sections: draft.sections },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: jiraTemplateKeys.all });
        },
      },
    );
  };

  const onReset = () => {
    if (!confirm('기본 템플릿으로 되돌립니다. 계속할까요?')) return;
    resetMutation.mutate(
      { kind },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: jiraTemplateKeys.all });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-ink-400">템플릿 이름</label>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="flex-1 rounded border border-ink-800 bg-ink-900 px-2 py-1 text-xs text-ink-100"
        />
      </div>

      <div className="flex flex-col gap-2">
        {draft.sections.map((s, i) => (
          <div
            key={i}
            className="rounded border border-ink-800 bg-ink-900/50 p-2 text-xs"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-ink-500">#{i + 1}</span>
              <input
                value={s.title}
                onChange={(e) => onChangeSection(i, { title: e.target.value })}
                className="flex-1 rounded border border-ink-800 bg-ink-900 px-2 py-1 text-ink-100"
                placeholder="섹션 제목"
              />
              <input
                value={s.key}
                onChange={(e) => onChangeSection(i, { key: e.target.value })}
                className="w-32 rounded border border-ink-800 bg-ink-900 px-2 py-1 text-ink-300"
                placeholder="key (영문)"
              />
              <label className="flex items-center gap-1 text-ink-300">
                <input
                  type="checkbox"
                  checked={s.required}
                  onChange={(e) => onChangeSection(i, { required: e.target.checked })}
                />
                필수
              </label>
              <button
                type="button"
                onClick={() => onMove(i, -1)}
                className="rounded px-1.5 py-0.5 text-ink-400 hover:bg-ink-800"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMove(i, 1)}
                className="rounded px-1.5 py-0.5 text-ink-400 hover:bg-ink-800"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onRemoveSection(i)}
                className="rounded px-1.5 py-0.5 text-red-400 hover:bg-ink-800"
              >
                ✕
              </button>
            </div>
            <textarea
              value={s.description}
              onChange={(e) => onChangeSection(i, { description: e.target.value })}
              rows={2}
              placeholder="이 섹션이 무엇을 담아야 하는지 설명"
              className="mb-1 w-full rounded border border-ink-800 bg-ink-900 px-2 py-1 text-ink-200"
            />
            <input
              value={s.hint}
              onChange={(e) => onChangeSection(i, { hint: e.target.value })}
              placeholder="작성 힌트 (예: 체크리스트 형식, URL 1개 이상 등)"
              className="w-full rounded border border-ink-800 bg-ink-900 px-2 py-1 text-ink-300"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={onAddSection}
          className="self-start rounded border border-dashed border-ink-700 px-2 py-1 text-xs text-ink-400 hover:bg-ink-800"
        >
          + 섹션 추가
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saveMutation.isPending}
          className="rounded bg-amber-700 px-3 py-1 text-xs text-amber-50 disabled:opacity-40"
        >
          {saveMutation.isPending ? '저장 중...' : '저장'}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={resetMutation.isPending}
          className="rounded border border-ink-800 px-3 py-1 text-xs text-ink-300 hover:bg-ink-800 disabled:opacity-40"
        >
          기본값으로 되돌리기
        </button>
        {dirty && <span className="text-xs text-amber-400">저장되지 않은 변경 있음</span>}
        {saveMutation.error && (
          <span className="text-xs text-red-400">
            {String(saveMutation.error)}
          </span>
        )}
      </div>
    </div>
  );
}
