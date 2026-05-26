import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ExtensionSettingsForm } from '../extensions/ExtensionSettingsForm';
import { slackMutations, slackQueries } from '../../../server-state/slack';
import {
  customRangeToWindow,
  parseThreadRefFromInput,
  presetToWindow,
  type SlackPeriodPreset,
} from '../../../business/slack/slack-period';
import type { SlackChannelSummary } from '../../../api/slack';

type Section = 'digest' | 'reactions' | 'settings';

const NAV: { key: Section; label: string; icon: string; hint: string }[] = [
  { key: 'digest', label: '요약', icon: '📝', hint: '채널/스레드 기간 요약' },
  { key: 'reactions', label: '내 북마크', icon: '🔖', hint: '내가 단 이모지 모아보기' },
  { key: 'settings', label: '설정', icon: '⚙', hint: 'Slack 토큰 · 이모지' },
];

export function SlackWorkspace() {
  const [section, setSection] = useState<Section>('digest');
  return (
    <div className="grid h-full grid-cols-[180px_1fr]">
      <nav className="flex flex-col gap-0.5 border-r border-ink-800 bg-ink-900/50 p-2">
        {NAV.map((n) => (
          <button
            key={n.key}
            type="button"
            onClick={() => setSection(n.key)}
            className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
              section === n.key
                ? 'bg-ink-800 text-ink-100'
                : 'text-ink-400 hover:bg-ink-850 hover:text-ink-200'
            }`}
            title={n.hint}
          >
            <span className="w-4 text-center">{n.icon}</span>
            <span className="truncate">{n.label}</span>
          </button>
        ))}
      </nav>
      <section className="min-w-0 overflow-y-auto p-4">
        {section === 'digest' && <DigestPanel />}
        {section === 'reactions' && <ReactionsPanel />}
        {section === 'settings' && <SettingsPanel />}
      </section>
    </div>
  );
}

// ---------- Digest ----------

const DIGEST_HISTORY_KEY = 'slack.digest.history.v1';
const DIGEST_HISTORY_MAX = 50;

function loadDigestHistory(): DigestHistoryItem[] {
  try {
    const raw = localStorage.getItem(DIGEST_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is DigestHistoryItem =>
        !!x && typeof x === 'object' && 'id' in x && 'result' in x,
    );
  } catch {
    return [];
  }
}

function saveDigestHistory(items: DigestHistoryItem[]): void {
  try {
    localStorage.setItem(
      DIGEST_HISTORY_KEY,
      JSON.stringify(items.slice(0, DIGEST_HISTORY_MAX)),
    );
  } catch {
    /* quota or unavailable — fine to ignore */
  }
}

type DigestHistoryItem = {
  id: string;
  at: number;
  channelId: string;
  channelLabel: string;
  threadTs: string | null;
  focus: string;
  result:
    | { ok: true; channelName: string; messageCount: number; summary: string }
    | { ok: false; error: string };
};

type DigestTab = 'channel' | 'thread';

function DigestPanel() {
  const channelsQ = useQuery(slackQueries.listChannels());
  const [tab, setTab] = useState<DigestTab>('channel');
  const [channelId, setChannelId] = useState('');
  const [channelSearch, setChannelSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [threadInput, setThreadInput] = useState('');
  const [preset, setPreset] = useState<SlackPeriodPreset>('24h');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [focus, setFocus] = useState('');
  const [history, setHistory] = useState<DigestHistoryItem[]>(() =>
    loadDigestHistory(),
  );
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  useEffect(() => {
    saveDigestHistory(history);
  }, [history]);
  const summarize = useMutation(slackMutations.summarize());

  const selectedChannel = useMemo<SlackChannelSummary | null>(() => {
    if (!channelId || !channelsQ.data?.ok) return null;
    return channelsQ.data.channels.find((c) => c.id === channelId) ?? null;
  }, [channelId, channelsQ.data]);

  const searchResults = useMemo<SlackChannelSummary[]>(() => {
    if (!channelsQ.data?.ok) return [];
    const q = channelSearch.trim().toLowerCase();
    if (!q) return [];
    return channelsQ.data.channels
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [channelsQ.data, channelSearch]);

  const channelWindow = useMemo(() => {
    if (preset === 'custom') {
      return customRangeToWindow(customFrom, customTo);
    }
    return presetToWindow(preset);
  }, [preset, customFrom, customTo]);

  const parsedThreadRef = useMemo(
    () => parseThreadRefFromInput(threadInput),
    [threadInput],
  );

  // 스레드 모드에서는 permalink 에서 뽑은 채널을 표시용으로만 사용.
  const threadChannelLabel = useMemo<string | null>(() => {
    if (!parsedThreadRef) return null;
    if (!channelsQ.data?.ok) return parsedThreadRef.channelId;
    const c = channelsQ.data.channels.find(
      (x) => x.id === parsedThreadRef.channelId,
    );
    return c?.name ?? parsedThreadRef.channelId;
  }, [parsedThreadRef, channelsQ.data]);

  const canRun = (() => {
    if (summarize.isPending) return false;
    if (tab === 'channel') return !!channelId && !!channelWindow;
    return !!parsedThreadRef;
  })();

  const onRun = () => {
    if (!canRun) return;
    const isThread = tab === 'thread';
    const w = isThread
      ? {
          // 스레드는 기간이 없으므로 충분히 넓은 윈도우로 전체를 잡는다.
          fromUnix: 0,
          toUnix: Math.floor(Date.now() / 1000),
        }
      : channelWindow!;
    const usedChannelId = isThread ? parsedThreadRef!.channelId : channelId;
    const ts = isThread ? parsedThreadRef!.threadTs : undefined;
    const trimmedFocus = focus.trim();
    const channelLabel = isThread
      ? threadChannelLabel ?? usedChannelId
      : selectedChannel?.name ?? channelId;
    summarize.mutate(
      {
        channelId: usedChannelId,
        threadTs: ts,
        fromUnix: w.fromUnix,
        toUnix: w.toUnix,
        focus: trimmedFocus || undefined,
      },
      {
        onSuccess: (data) => {
          const id =
            (typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
          const item: DigestHistoryItem = {
            id,
            at: Date.now(),
            channelId: usedChannelId,
            channelLabel,
            threadTs: ts ?? null,
            focus: trimmedFocus,
            result: data.ok
              ? {
                  ok: true,
                  channelName: data.channelName,
                  messageCount: data.messageCount,
                  summary: data.summary,
                }
              : { ok: false, error: data.error },
          };
          setHistory((prev) => [item, ...prev]);
          setOpenHistoryId(id);
        },
        onError: (err) => {
          const id =
            (typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
          const item: DigestHistoryItem = {
            id,
            at: Date.now(),
            channelId: usedChannelId,
            channelLabel,
            threadTs: ts ?? null,
            focus: trimmedFocus,
            result: {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
          };
          setHistory((prev) => [item, ...prev]);
          setOpenHistoryId(id);
        },
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Hero
        title="요약"
        hint="채널 전체 기간을 요약하거나, 특정 스레드만 요약합니다. 채널을 먼저 고른 뒤 아래 탭에서 모드를 선택하세요."
      />

      {/* ─── 모드 탭 ─── */}
      <div className="flex gap-1 border-b border-ink-800">
        {(
          [
            { key: 'channel', label: '채널 요약', hint: '선택한 기간 동안의 채널 대화' },
            { key: 'thread', label: '스레드 요약', hint: 'Slack 메시지 링크 한 줄' },
          ] as { key: DigestTab; label: string; hint: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            title={t.hint}
            className={`-mb-px rounded-t border border-b-0 px-3 py-1.5 text-xs transition ${
              tab === t.key
                ? 'border-ink-800 bg-ink-900 text-ink-100'
                : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'channel' ? (
        <>
          {/* ─── 채널 선택 (검색 + 칩) ─── */}
          <Card>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>채널</Label>
              <button
                type="button"
                onClick={() => channelsQ.refetch()}
                disabled={channelsQ.isFetching}
                className="rounded border border-ink-700 px-2 py-0.5 text-[10px] text-ink-300 hover:bg-ink-850 disabled:opacity-50"
                title="Slack 에서 채널 목록을 다시 가져와 캐시를 갱신합니다."
              >
                {channelsQ.isFetching ? '갱신 중…' : '🔄 새로고침'}
              </button>
            </div>
            {selectedChannel ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/60 bg-emerald-600/20 px-2.5 py-1 text-[11px] text-emerald-100">
                  <span>{kindBadge(selectedChannel.kind)}</span>
                  <span className="font-medium">{selectedChannel.name}</span>
                  <span className="text-emerald-300/70">({selectedChannel.id})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setChannelId('');
                      setChannelSearch('');
                    }}
                    className="ml-1 rounded-full text-emerald-200/80 hover:text-rose-200"
                    title="채널 선택 해제"
                    aria-label="채널 선택 해제"
                  >
                    ✕
                  </button>
                </span>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => {
                    // 드롭다운 항목 클릭이 살아남도록 짧게 지연.
                    window.setTimeout(() => setSearchFocused(false), 120);
                  }}
                  placeholder="채널 검색 (이름 또는 ID)"
                  className={INPUT_CLASS}
                />
                {channelsQ.isLoading && !channelsQ.data && (
                  <Hint>채널 목록 불러오는 중…</Hint>
                )}
                {channelsQ.data?.ok === false && (
                  <Err>채널 목록 실패: {channelsQ.data.error}</Err>
                )}
                {channelsQ.data?.ok &&
                  searchFocused &&
                  channelSearch.trim() !== '' && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded border border-ink-800 bg-ink-950 shadow-lg">
                      {searchResults.length === 0 ? (
                        <div className="px-2 py-2 text-[11px] text-ink-500">
                          (매칭되는 채널 없음)
                        </div>
                      ) : (
                        <ul className="flex flex-col">
                          {searchResults.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setChannelId(c.id);
                                  setChannelSearch('');
                                  setSearchFocused(false);
                                }}
                                className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] text-ink-200 hover:bg-ink-850"
                              >
                                <span className="w-4 text-center">
                                  {kindBadge(c.kind)}
                                </span>
                                <span className="truncate">{c.name}</span>
                                {!c.isMember && (
                                  <span className="ml-auto shrink-0 text-[10px] text-ink-500">
                                    미참여
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                {channelsQ.data?.ok && (
                  <Hint>
                    채널명/ID 일부를 입력해 선택하세요 · 총{' '}
                    {channelsQ.data.channels.length}개 캐시됨
                  </Hint>
                )}
              </div>
            )}
          </Card>

          <Card>
            <Label>기간</Label>
            <div className="flex flex-wrap gap-1.5">
              {(['today', '24h', '7d', '30d', 'custom'] as SlackPeriodPreset[]).map(
                (p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreset(p)}
                    className={`rounded border px-2 py-1 text-xs ${
                      preset === p
                        ? 'border-emerald-600/60 bg-emerald-600/20 text-emerald-200'
                        : 'border-ink-700 text-ink-300 hover:bg-ink-850'
                    }`}
                  >
                    {presetLabel(p)}
                  </button>
                ),
              )}
            </div>
            {preset === 'custom' && (
              <div className="mt-2 flex gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className={INPUT_CLASS}
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <Label>스레드 링크</Label>
          <input
            type="text"
            value={threadInput}
            onChange={(e) => setThreadInput(e.target.value)}
            placeholder="예: https://your-workspace.slack.com/archives/C0123ABCDE/p1700000000123456"
            className={INPUT_CLASS}
          />
          {threadInput.trim() === '' ? (
            <Hint>
              Slack 메시지에서 우클릭 → "링크 복사" 로 받은 permalink 를 그대로
              붙여넣으세요. 채널 정보는 링크에서 자동으로 추출합니다.
            </Hint>
          ) : parsedThreadRef ? (
            <Hint>
              감지됨 · 채널{' '}
              <span className="text-emerald-300">#{threadChannelLabel}</span>
              {' '}({parsedThreadRef.channelId}) · ts {parsedThreadRef.threadTs}
            </Hint>
          ) : (
            <Err>
              Slack permalink 형식이 아닙니다. 메시지에서 "링크 복사"로 받은
              URL 전체를 붙여넣어 주세요.
            </Err>
          )}
        </Card>
      )}

      <Card>
        <Label>요약 포커스 (선택)</Label>
        <textarea
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          rows={2}
          placeholder='예: "결정사항 중심으로", "API 변경 관련 부분만"'
          className={INPUT_CLASS}
        />
      </Card>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun}
            className="rounded border border-emerald-600/60 bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-50"
          >
            {summarize.isPending
              ? '요약 실행 중… (터미널 패널 확인)'
              : tab === 'thread'
                ? '🧵 스레드 요약 실행'
                : '🚀 채널 요약 실행'}
          </button>
          {tab === 'channel' && !channelId && (
            <Hint>먼저 위에서 채널을 선택하세요.</Hint>
          )}
          {tab === 'channel' && channelId && !channelWindow && preset === 'custom' && (
            <Err>날짜 범위가 올바르지 않습니다.</Err>
          )}
          {tab === 'thread' && !parsedThreadRef && threadInput.trim() === '' && (
            <Hint>Slack 메시지 permalink 를 붙여넣으세요.</Hint>
          )}
        </div>

        {summarize.isPending && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
            claude CLI 를 확장 터미널 패널에서 실행 중입니다. 하단 터미널 패널이
            열리지 않았다면 액티비티 바에서 Slack 확장이 활성화돼 있는지,
            확장 설정이 비어 있지 않은지 확인하세요. 응답까지 수십 초 ~ 수 분.
          </div>
        )}

      </div>

      {history.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>요약 히스토리</Label>
            <button
              type="button"
              onClick={() => {
                setHistory([]);
                setOpenHistoryId(null);
              }}
              className="rounded border border-ink-700 px-2 py-0.5 text-[10px] text-ink-300 hover:bg-ink-850"
              title="이 화면에 누적된 요약 결과를 모두 지웁니다."
            >
              전체 삭제
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {history.map((h) => {
              const open = openHistoryId === h.id;
              return (
                <li
                  key={h.id}
                  className="overflow-hidden rounded border border-ink-800 bg-ink-900/40"
                >
                  <div className="flex w-full items-stretch text-[11px]">
                    <button
                      type="button"
                      onClick={() => setOpenHistoryId(open ? null : h.id)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left hover:bg-ink-850"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                            h.result.ok
                              ? 'bg-emerald-600/20 text-emerald-200'
                              : 'bg-rose-500/20 text-rose-200'
                          }`}
                        >
                          {h.result.ok ? 'OK' : 'ERR'}
                        </span>
                        <span className="truncate font-medium text-ink-100">
                          #{h.result.ok ? h.result.channelName : h.channelLabel}
                          {h.threadTs ? ' · thread' : ''}
                        </span>
                        {h.result.ok && (
                          <span className="shrink-0 text-ink-500">
                            {h.result.messageCount}개
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-ink-500">
                        {new Date(h.at).toLocaleString()}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHistory((prev) => prev.filter((x) => x.id !== h.id));
                        setOpenHistoryId((cur) => (cur === h.id ? null : cur));
                      }}
                      className="shrink-0 border-l border-ink-800 px-2 text-ink-500 hover:bg-rose-500/10 hover:text-rose-300"
                      title="이 요약 결과를 삭제"
                      aria-label="이 요약 결과를 삭제"
                    >
                      ✕
                    </button>
                  </div>
                  {open && (
                    <div className="border-t border-ink-800 p-3">
                      {h.focus && (
                        <div className="mb-2 text-[11px] text-ink-400">
                          포커스: {h.focus}
                        </div>
                      )}
                      {h.result.ok ? (
                        <pre className="whitespace-pre-wrap break-words rounded border border-ink-800 bg-ink-950/60 p-3 text-[12px] leading-relaxed text-ink-100">
                          {h.result.summary}
                        </pre>
                      ) : (
                        <Err>{h.result.error}</Err>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Reactions ----------

function ReactionsPanel() {
  const [emojis, setEmojis] = useState('bookmark');
  const collect = useMutation(slackMutations.fetchMyReactions());

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Hero
        title="내가 단 이모지 모아보기"
        hint="User Token(xoxp) 필요. Slack 의 reactions.list API 로 내가 직접 reaction 을 단 메시지만 가져옵니다."
      />

      <Card>
        <Label>수집할 이모지 (콤마/공백 구분)</Label>
        <input
          type="text"
          value={emojis}
          onChange={(e) => setEmojis(e.target.value)}
          placeholder="bookmark, star, memo"
          className={INPUT_CLASS}
        />
        <div className="mt-2">
          <button
            type="button"
            onClick={() => collect.mutate({ emojis })}
            disabled={!emojis.trim() || collect.isPending}
            className="rounded border border-emerald-600/60 bg-emerald-600/20 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-50"
          >
            {collect.isPending ? '수집 중…' : '🔍 내 reaction 수집'}
          </button>
        </div>
      </Card>

      {collect.data && (
        <Card>
          {collect.data.ok ? (
            collect.data.hits.length === 0 ? (
              <Hint>지정한 이모지를 단 메시지가 없습니다.</Hint>
            ) : (
              <ul className="flex flex-col divide-y divide-ink-800">
                {collect.data.hits.map((h) => (
                  <li key={`${h.channelId}-${h.ts}`} className="py-2">
                    <div className="flex items-center gap-2 text-[11px] text-ink-400">
                      <span>#{h.channelName}</span>
                      <span>·</span>
                      <span>{new Date(h.at).toLocaleString()}</span>
                      <span className="ml-auto">
                        {h.emojis.map((e) => `:${e}:`).join(' ')}
                      </span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-[12px] text-ink-100">
                      {h.text || <span className="text-ink-500">(텍스트 없음)</span>}
                    </div>
                    {h.userName && (
                      <div className="mt-1 text-[11px] text-ink-500">
                        — {h.userName}
                      </div>
                    )}
                  </li>
                ))}
                {collect.data.truncated && (
                  <li className="py-2 text-[11px] text-ink-500">
                    … 결과가 더 있을 수 있습니다. 설정에서 maxPages 를 늘리세요.
                  </li>
                )}
              </ul>
            )
          ) : (
            <Err>{collect.data.error}</Err>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------- Settings ----------

function SettingsPanel() {
  const test = useMutation(slackMutations.testConnection());
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Hero
        title="연결 설정"
        hint="토큰은 OS 보안 저장소(safeStorage)로 암호화돼 디스크에 저장됩니다."
      />
      <ExtensionSettingsForm extensionId="workos.slack" />
      <Card>
        <button
          type="button"
          onClick={() => test.mutate()}
          disabled={test.isPending}
          className="rounded border border-ink-700 px-2.5 py-1 text-xs text-ink-200 hover:bg-ink-850 disabled:opacity-50"
        >
          {test.isPending ? '확인 중…' : '🔌 연결 테스트'}
        </button>
        {test.data && (
          <div className="mt-2 text-[11px]">
            {test.data.ok ? (
              <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                {test.data.tokenMode === 'user' ? 'User Token' : 'Bot Token'} 로 연결 OK ·
                user={test.data.userName} ({test.data.userId})
                {test.data.teamId ? ` · team=${test.data.teamId}` : ''}
              </div>
            ) : (
              <Err>{test.data.error}</Err>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- atoms ----------

const INPUT_CLASS =
  'block w-full rounded border border-ink-700 bg-ink-950/60 px-2 py-1 text-xs text-ink-100 placeholder:text-ink-500 focus:border-emerald-600/60 focus:outline-none';

function Card(props: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-ink-800 bg-ink-900/40 p-3">
      {props.children}
    </div>
  );
}

function Hero(props: { title: string; hint: string }) {
  return (
    <div className="rounded border border-ink-800 bg-ink-900/50 p-3 text-xs leading-relaxed text-ink-300">
      <div className="mb-1 font-semibold text-ink-200">{props.title}</div>
      {props.hint}
    </div>
  );
}

function Label(props: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-semibold text-ink-200">
      {props.children}
    </div>
  );
}

function Hint(props: { children: React.ReactNode }) {
  return <div className="mt-1 text-[11px] text-ink-500">{props.children}</div>;
}

function Err(props: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
      {props.children}
    </div>
  );
}

function kindBadge(kind: SlackChannelSummary['kind']): string {
  switch (kind) {
    case 'public':
      return '#';
    case 'private':
      return '🔒';
    case 'im':
      return '💬';
    case 'mpim':
      return '👥';
    case 'group':
      return '🗂';
    default:
      return '·';
  }
}

function presetLabel(p: SlackPeriodPreset): string {
  switch (p) {
    case 'today':
      return '오늘';
    case '24h':
      return '24시간';
    case '7d':
      return '7일';
    case '30d':
      return '30일';
    case 'custom':
      return '직접 입력';
  }
}
