import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  jiraSnapshotKeys,
  jiraSnapshotMutations,
  jiraSnapshotQueries,
  type SyncProgressEvent,
} from '../../../server-state/jira';
import { jiraSnapshotApi } from '../../../api/jira/snapshot';
import { OverviewTab } from './dashboard/OverviewTab';
import { StatsTab } from './dashboard/StatsTab';
import { TimelineTab } from './dashboard/TimelineTab';

type TabKey = 'overview' | 'timeline' | 'stats';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'timeline', label: '타임라인' },
  { key: 'stats', label: '통계' },
];

export function JiraDashboard() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null);
  const queryClient = useQueryClient();

  const latestQuery = useQuery(jiraSnapshotQueries.latest());
  const metaQuery = useQuery(jiraSnapshotQueries.meta());
  const sync = useMutation({
    ...jiraSnapshotMutations.trigger(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jiraSnapshotKeys.all });
    },
  });

  useEffect(() => {
    const off = jiraSnapshotApi.onProgress((event) => {
      setProgress(event);
      if (event.phase === 'completed' || event.phase === 'failed') {
        // Clear after a short delay so the final state is visible briefly.
        setTimeout(() => setProgress(null), 2_000);
      }
    });
    return off;
  }, []);

  const issues = latestQuery.data?.issues ?? [];

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded border border-ink-800 bg-ink-900/60 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded px-2.5 py-1 text-xs ${
                tab === t.key
                  ? 'bg-ink-800 text-ink-100'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LastSyncBadge
            syncedAt={latestQuery.data?.syncedAt ?? null}
            lastSyncAt={metaQuery.data?.lastSyncAt ?? null}
          />
          <button
            type="button"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="rounded border border-ink-700 px-2 py-1 text-xs text-ink-200 hover:bg-ink-850 disabled:opacity-50"
          >
            {sync.isPending ? '동기화 중…' : '↻ 지금 동기화'}
          </button>
        </div>
      </header>

      {progress && (
        <div className="rounded border border-ink-700 bg-ink-900/70 px-2.5 py-1.5 text-[11px] text-ink-300">
          {phaseLabel(progress)}
          {progress.message ? ` — ${progress.message}` : ''}
          {typeof progress.count === 'number' ? ` (${progress.count}건)` : ''}
        </div>
      )}

      {sync.isError && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-[11px] text-rose-300">
          동기화 실패: {(sync.error as Error).message}
        </div>
      )}

      {latestQuery.isLoading ? (
        <div className="py-12 text-center text-xs text-ink-500">불러오는 중…</div>
      ) : !latestQuery.data ? (
        <EmptySnapshot onSync={() => sync.mutate()} syncing={sync.isPending} />
      ) : tab === 'overview' ? (
        <OverviewTab issues={issues} />
      ) : tab === 'timeline' ? (
        <TimelineTab issues={issues} />
      ) : (
        <StatsTab issues={issues} />
      )}
    </div>
  );
}

function LastSyncBadge({
  syncedAt,
  lastSyncAt,
}: {
  syncedAt: string | null;
  lastSyncAt: string | null;
}) {
  const at = syncedAt ?? lastSyncAt;
  if (!at) return null;
  const d = new Date(at);
  return (
    <span className="text-[10px] text-ink-500">
      마지막 동기화 · {d.toLocaleString()}
    </span>
  );
}

function EmptySnapshot({
  onSync,
  syncing,
}: {
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded border border-dashed border-ink-700 bg-ink-900/40 p-10 text-center">
      <div className="text-sm text-ink-200">아직 동기화된 데이터가 없습니다.</div>
      <p className="max-w-md text-xs text-ink-500">
        Jira 설정에서 baseUrl/이메일/토큰/프로젝트 키를 확인한 뒤, 아래 버튼으로
        첫 스냅샷을 만들어주세요. 이후에는 09:00 / 13:00 / 18:00 에 자동 동기화됩니다.
      </p>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="rounded bg-claude-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-claude-400 disabled:opacity-50"
      >
        {syncing ? '동기화 중…' : '첫 동기화 시작'}
      </button>
    </div>
  );
}

function phaseLabel(event: SyncProgressEvent): string {
  switch (event.phase) {
    case 'started':
      return '동기화 시작';
    case 'fetching':
      return 'Jira 조회 중';
    case 'saving':
      return '저장 중';
    case 'completed':
      return '완료';
    case 'failed':
      return '실패';
  }
}
