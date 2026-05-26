import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { jiraReviewMutations } from '../../../server-state/jira/review';
import type {
  ReviewSection,
  ReviewSeverity,
  TicketReviewResult,
} from '../../../api/jira/review';

const SEVERITY_COLOR: Record<ReviewSeverity, string> = {
  ok: 'text-emerald-400 border-emerald-700',
  low: 'text-sky-300 border-sky-700',
  medium: 'text-amber-300 border-amber-700',
  high: 'text-red-300 border-red-700',
};

const SEVERITY_LABEL: Record<ReviewSeverity, string> = {
  ok: 'OK',
  low: '경미',
  medium: '중요',
  high: '필수',
};

/**
 * 단일 이슈에 대한 내용 검토 패널. 이슈 키는 부모(IssueDetailModal 등)에서 주입한다.
 * 모달 안에서 인라인으로 사용되는 것을 가정해 상하 마진/배경을 갖지 않는다.
 */
export function TicketReviewPanel({ issueKey }: { issueKey: string }) {
  const [proposed, setProposed] = useState<string>('');
  const [result, setResult] = useState<TicketReviewResult | null>(null);
  const [applied, setApplied] = useState(false);

  const reviewMutation = useMutation(jiraReviewMutations.review());
  const applyMutation = useMutation(jiraReviewMutations.apply());

  const onReview = () => {
    setApplied(false);
    setResult(null);
    setProposed('');
    reviewMutation.mutate(
      { issueKey },
      {
        onSuccess: (data) => {
          setResult(data);
          setProposed(data.proposedDescription);
        },
      },
    );
  };

  const onApply = () => {
    if (!result) return;
    if (!confirm(`${result.issueKey} 의 본문을 제안 내용으로 덮어씁니다. 계속할까요?`)) return;
    applyMutation.mutate(
      { issueKey: result.issueKey, description: proposed },
      { onSuccess: () => setApplied(true) },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs leading-relaxed text-ink-400">
          템플릿 기준으로 본문을 검토하고 보완안을 제안합니다.
          {' '}상위 에픽이 있으면 에픽 본문 + 형제 티켓을, 에픽이면 자식 티켓을 컨텍스트로 사용합니다.
        </div>
        <button
          type="button"
          onClick={onReview}
          disabled={reviewMutation.isPending}
          className="shrink-0 rounded bg-amber-700 px-3 py-1 text-xs text-amber-50 disabled:opacity-40"
        >
          {reviewMutation.isPending ? '검토 중...' : result ? '다시 검토' : '내용 검토'}
        </button>
      </div>

      {reviewMutation.error && (
        <div className="rounded border border-red-800 bg-red-950/40 p-2 text-xs text-red-300">
          {String(reviewMutation.error)}
        </div>
      )}

      {result && (
        <ReviewResultView
          result={result}
          proposed={proposed}
          onProposedChange={setProposed}
          onApply={onApply}
          applying={applyMutation.isPending}
          applied={applied}
          applyError={applyMutation.error ? String(applyMutation.error) : null}
        />
      )}
    </div>
  );
}

function ReviewResultView({
  result,
  proposed,
  onProposedChange,
  onApply,
  applying,
  applied,
  applyError,
}: {
  result: TicketReviewResult;
  proposed: string;
  onProposedChange: (s: string) => void;
  onApply: () => void;
  applying: boolean;
  applied: boolean;
  applyError: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded border border-ink-800 bg-ink-900/60 p-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[11px] text-ink-400">
            적용 템플릿: <span className="text-ink-200">{result.kind}</span>
            {result.parentEpicKey && (
              <>
                {' '}· 상위 에픽: <span className="text-ink-200">{result.parentEpicKey}</span>
              </>
            )}
          </div>
          <div className="text-right">
            <span className="text-base font-semibold text-amber-300">
              {result.overall.qualityScore}
            </span>
            <span className="text-[10px] text-ink-400">/100</span>
          </div>
        </div>
        {result.overall.headline && (
          <div className="mt-1.5 text-xs leading-relaxed text-ink-200">
            {result.overall.headline}
          </div>
        )}
        {result.overall.missingSections.length > 0 && (
          <div className="mt-1 text-[11px] text-amber-400">
            누락/보완: {result.overall.missingSections.join(', ')}
          </div>
        )}
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-ink-200">섹션별 진단</div>
        <div className="flex flex-col gap-1.5">
          {result.sections.map((s) => (
            <SectionRow key={s.key} section={s} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-xs font-medium text-ink-200">제안 본문 (마크다운)</div>
          <div className="text-[10px] text-ink-500">
            직접 수정 가능 — 적용 시 Jira 본문이 이 내용으로 교체됨
          </div>
        </div>
        <textarea
          value={proposed}
          onChange={(e) => onProposedChange(e.target.value)}
          rows={14}
          className="w-full rounded border border-ink-800 bg-ink-900 px-2 py-1 font-mono text-xs leading-relaxed text-ink-100"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={!proposed.trim() || applying || applied}
          className="rounded bg-emerald-700 px-3 py-1 text-xs text-emerald-50 disabled:opacity-40"
        >
          {applying ? '적용 중...' : applied ? '적용 완료' : 'Jira 에 적용'}
        </button>
        {applyError && <span className="text-xs text-red-400">{applyError}</span>}
        {applied && (
          <span className="text-xs text-emerald-400">Jira 본문이 업데이트되었습니다.</span>
        )}
      </div>
    </div>
  );
}

function SectionRow({ section }: { section: ReviewSection }) {
  const [open, setOpen] = useState(
    section.severity === 'high' || section.severity === 'medium',
  );
  return (
    <div
      className={`rounded border bg-ink-900/40 p-2 text-xs ${SEVERITY_COLOR[section.severity]}`}
    >
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="font-medium">
          {section.title}{' '}
          <span className="ml-1 rounded border px-1 py-px text-[10px]">
            {SEVERITY_LABEL[section.severity]}
          </span>
        </span>
        <span className="text-ink-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 text-ink-200">
          {section.currentValue && (
            <div>
              <span className="text-ink-400">현재: </span>
              <span className="whitespace-pre-wrap">{section.currentValue}</span>
            </div>
          )}
          {section.gap && (
            <div>
              <span className="text-ink-400">격차: </span>
              <span className="whitespace-pre-wrap">{section.gap}</span>
            </div>
          )}
          {section.suggestion && (
            <div>
              <span className="text-ink-400">제안: </span>
              <span className="whitespace-pre-wrap">{section.suggestion}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
