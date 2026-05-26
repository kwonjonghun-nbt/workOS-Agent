import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExtensionSettingsForm } from '../extensions/ExtensionSettingsForm';
import { slackKeys, slackMutations, slackQueries } from '../../../server-state/slack';
import {
  customRangeToWindow,
  parseThreadRefFromInput,
  presetToWindow,
  type SlackPeriodPreset,
} from '../../../business/slack/slack-period';
import type {
  SlackChannelSummary,
  SlackSummaryTemplate,
  SlackThreadChannelMeta,
  SlackThreadParent,
} from '../../../api/slack';
import {
  SUMMARY_TEMPLATE_OPTIONS,
  loadPreferredTemplate,
  savePreferredTemplate,
  templateIcon,
  templateLabel,
} from '../../../business/slack/slack-summary-template';

type Section = 'topics' | 'digest' | 'reactions' | 'settings';

const NAV: { key: Section; label: string; icon: string; hint: string }[] = [
  { key: 'topics', label: '주제 리스트', icon: '🗂', hint: '채널별 스레드를 캐싱해 오프라인 열람' },
  { key: 'digest', label: '요약', icon: '📝', hint: '채널/스레드 기간 요약' },
  { key: 'reactions', label: '내 북마크', icon: '🔖', hint: '내가 단 이모지 모아보기' },
  { key: 'settings', label: '설정', icon: '⚙', hint: 'Slack 토큰 · 이모지' },
];

export function SlackWorkspace() {
  const [section, setSection] = useState<Section>('topics');
  // Digest summary history is owned at the workspace level so the topics view
  // can both append new entries (when the user summarizes from a thread row)
  // and jump straight into the digest panel with a specific entry expanded.
  const [history, setHistory] = useState<DigestHistoryItem[]>(() =>
    loadDigestHistory(),
  );
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  useEffect(() => {
    saveDigestHistory(history);
  }, [history]);

  const addHistoryAndOpen = (item: DigestHistoryItem) => {
    setHistory((prev) => [item, ...prev]);
    setOpenHistoryId(item.id);
    setSection('digest');
  };
  const openExistingSummary = (id: string) => {
    setOpenHistoryId(id);
    setSection('digest');
  };

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
        {section === 'topics' && (
          <TopicsPanel
            history={history}
            addHistoryAndOpen={addHistoryAndOpen}
            openExistingSummary={openExistingSummary}
          />
        )}
        {section === 'digest' && (
          <DigestPanel
            history={history}
            setHistory={setHistory}
            openHistoryId={openHistoryId}
            setOpenHistoryId={setOpenHistoryId}
          />
        )}
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

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  /** Template used to produce this summary. Optional for backward compatibility with older localStorage entries. */
  template?: SlackSummaryTemplate;
  result:
    | { ok: true; channelName: string; messageCount: number; summary: string }
    | { ok: false; error: string };
};

type DigestTab = 'channel' | 'thread';

function DigestPanel(props: {
  history: DigestHistoryItem[];
  setHistory: React.Dispatch<React.SetStateAction<DigestHistoryItem[]>>;
  openHistoryId: string | null;
  setOpenHistoryId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const { history, setHistory, openHistoryId, setOpenHistoryId } = props;
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
  const [template, setTemplate] = useState<SlackSummaryTemplate>(() =>
    loadPreferredTemplate(),
  );
  useEffect(() => {
    savePreferredTemplate(template);
  }, [template]);
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
        template,
      },
      {
        onSuccess: (data) => {
          const id = randomId();
          const item: DigestHistoryItem = {
            id,
            at: Date.now(),
            channelId: usedChannelId,
            channelLabel,
            threadTs: ts ?? null,
            focus: trimmedFocus,
            template,
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
          const id = randomId();
          const item: DigestHistoryItem = {
            id,
            at: Date.now(),
            channelId: usedChannelId,
            channelLabel,
            threadTs: ts ?? null,
            focus: trimmedFocus,
            template,
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
        <Label>요약 템플릿</Label>
        <TemplatePicker value={template} onChange={setTemplate} />
      </Card>

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
                      <SummaryViewer item={h} />
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

// ---------- Topics ----------

const TOPIC_DAYS_DEFAULT = 90;
type TopicFilter = 'bracket' | 'all';

function TopicsPanel(props: {
  history: DigestHistoryItem[];
  addHistoryAndOpen: (item: DigestHistoryItem) => void;
  openExistingSummary: (id: string) => void;
}) {
  const qc = useQueryClient();
  const channelsQ = useQuery(slackQueries.listChannels());
  const cacheListQ = useQuery(slackQueries.listThreadChannels());

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [days, setDays] = useState<number>(TOPIC_DAYS_DEFAULT);

  const addM = useMutation(slackMutations.addThreadChannel());
  const refreshM = useMutation(slackMutations.refreshThreadChannel());
  const removeM = useMutation(slackMutations.removeThreadChannel());

  const registeredIds = useMemo(
    () =>
      new Set(
        cacheListQ.data?.ok ? cacheListQ.data.channels.map((c) => c.channelId) : [],
      ),
    [cacheListQ.data],
  );

  const searchResults = useMemo<SlackChannelSummary[]>(() => {
    if (!channelsQ.data?.ok) return [];
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return channelsQ.data.channels
      .filter(
        (c) =>
          (c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) &&
          !registeredIds.has(c.id),
      )
      .slice(0, 20);
  }, [channelsQ.data, search, registeredIds]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: slackKeys.threadChannels() });
  };

  const onAdd = (channelId: string) => {
    addM.mutate(
      { channelId, days },
      {
        onSuccess: (data) => {
          if (data.ok) {
            qc.setQueryData(slackKeys.threadChannel(channelId), data);
            setActiveChannelId(channelId);
          }
          invalidateAll();
        },
      },
    );
    setSearch('');
    setSearchFocused(false);
  };

  const onRefresh = (channelId: string) => {
    refreshM.mutate(
      { channelId, days },
      {
        onSuccess: (data) => {
          if (data.ok) {
            qc.setQueryData(slackKeys.threadChannel(channelId), data);
          }
          invalidateAll();
        },
      },
    );
  };

  const onRemove = (channelId: string) => {
    if (!window.confirm('이 채널의 캐시를 삭제할까요? 다시 추가하면 새로 수집합니다.')) {
      return;
    }
    removeM.mutate(
      { channelId },
      {
        onSuccess: () => {
          qc.removeQueries({ queryKey: slackKeys.threadChannel(channelId) });
          if (activeChannelId === channelId) setActiveChannelId(null);
          invalidateAll();
        },
      },
    );
  };

  const list = cacheListQ.data?.ok ? cacheListQ.data.channels : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Hero
        title="주제 리스트"
        hint="채널을 추가하면 최근 N일의 스레드 부모 메시지와 답글을 한꺼번에 가져와 로컬에 저장합니다. 이후엔 갱신 버튼을 누르기 전까지 네트워크 없이 열람합니다."
      />

      {/* 채널 추가 */}
      <Card>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Label>채널 추가</Label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-400">수집 기간</span>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) =>
                setDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))
              }
              className="w-16 rounded border border-ink-700 bg-ink-950/60 px-1.5 py-0.5 text-xs text-ink-100"
            />
            <span className="text-[11px] text-ink-400">일</span>
            <button
              type="button"
              onClick={() => channelsQ.refetch()}
              disabled={channelsQ.isFetching}
              className="rounded border border-ink-700 px-2 py-0.5 text-[10px] text-ink-300 hover:bg-ink-850 disabled:opacity-50"
              title="Slack 채널 목록 캐시를 갱신합니다."
            >
              {channelsQ.isFetching ? '…' : '🔄 채널목록'}
            </button>
          </div>
        </div>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
            placeholder="채널 검색 (이름 또는 ID) — 클릭하면 캐시에 등록"
            className={INPUT_CLASS}
          />
          {channelsQ.data?.ok === false && (
            <Err>채널 목록 실패: {channelsQ.data.error}</Err>
          )}
          {channelsQ.data?.ok &&
            searchFocused &&
            search.trim() !== '' && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded border border-ink-800 bg-ink-950 shadow-lg">
                {searchResults.length === 0 ? (
                  <div className="px-2 py-2 text-[11px] text-ink-500">
                    (매칭되는 미등록 채널 없음)
                  </div>
                ) : (
                  <ul className="flex flex-col">
                    {searchResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onAdd(c.id)}
                          className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] text-ink-200 hover:bg-ink-850"
                        >
                          <span className="w-4 text-center">
                            {kindBadge(c.kind)}
                          </span>
                          <span className="truncate">{c.name}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-ink-500">
                            ＋ 추가
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
        </div>
        {addM.isPending && (
          <Hint>채널 수집 중… 부모 메시지마다 답글을 한 번씩 가져오므로 수십 초 걸릴 수 있어요.</Hint>
        )}
        {addM.data && !addM.data.ok && <Err>{addM.data.error}</Err>}
      </Card>

      {/* 등록 채널 목록 + 본문 */}
      <div className="grid grid-cols-[260px_1fr] gap-3">
        <Card>
          <Label>등록 채널 ({list.length})</Label>
          {cacheListQ.isLoading && <Hint>로딩 중…</Hint>}
          {cacheListQ.data?.ok === false && <Err>{cacheListQ.data.error}</Err>}
          {list.length === 0 && cacheListQ.data?.ok && (
            <Hint>아직 등록된 채널이 없습니다. 위에서 채널을 검색해 추가하세요.</Hint>
          )}
          <ul className="flex flex-col gap-1">
            {list.map((c) => (
              <li key={c.channelId}>
                <button
                  type="button"
                  onClick={() => setActiveChannelId(c.channelId)}
                  className={`flex w-full items-center gap-1.5 rounded border px-2 py-1.5 text-left text-[11px] transition ${
                    activeChannelId === c.channelId
                      ? 'border-emerald-600/60 bg-emerald-600/15 text-emerald-100'
                      : 'border-ink-800 bg-ink-900/40 text-ink-200 hover:bg-ink-850'
                  }`}
                  title={`#${c.channelName} · ${c.threadCount}개 스레드`}
                >
                  <span className="truncate font-medium">#{c.channelName}</span>
                  <span className="ml-auto shrink-0 text-ink-500">
                    {c.threadCount}
                  </span>
                </button>
                {activeChannelId === c.channelId && (
                  <ChannelMetaRow
                    meta={c}
                    busy={refreshM.isPending || removeM.isPending}
                    onRefresh={() => onRefresh(c.channelId)}
                    onRemove={() => onRemove(c.channelId)}
                  />
                )}
              </li>
            ))}
          </ul>
        </Card>

        <div className="min-w-0">
          {activeChannelId ? (
            <ChannelThreadList
              channelId={activeChannelId}
              history={props.history}
              addHistoryAndOpen={props.addHistoryAndOpen}
              openExistingSummary={props.openExistingSummary}
            />
          ) : (
            <Card>
              <Hint>왼쪽 목록에서 채널을 선택하세요.</Hint>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelMetaRow(props: {
  meta: SlackThreadChannelMeta;
  busy: boolean;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2 rounded border border-ink-800 bg-ink-950/60 px-2 py-1 text-[10px] text-ink-400">
      <span title={`추가: ${props.meta.addedAt}\n갱신: ${props.meta.refreshedAt}`}>
        최근 갱신 {new Date(props.meta.refreshedAt).toLocaleString()} · {props.meta.days}일
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={props.onRefresh}
          disabled={props.busy}
          className="rounded border border-ink-700 px-1.5 py-0.5 text-ink-300 hover:bg-ink-850 disabled:opacity-50"
          title="이 채널의 스레드 캐시를 다시 가져옵니다."
        >
          {props.busy ? '…' : '🔄 갱신'}
        </button>
        <button
          type="button"
          onClick={props.onRemove}
          disabled={props.busy}
          className="rounded border border-rose-500/40 px-1.5 py-0.5 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
          title="이 채널의 캐시를 삭제합니다."
        >
          🗑 삭제
        </button>
      </div>
    </div>
  );
}

function ChannelThreadList(props: {
  channelId: string;
  history: DigestHistoryItem[];
  addHistoryAndOpen: (item: DigestHistoryItem) => void;
  openExistingSummary: (id: string) => void;
}) {
  const cacheQ = useQuery(slackQueries.loadThreadChannel(props.channelId));
  const [filter, setFilter] = useState<TopicFilter>('bracket');
  const [query, setQuery] = useState('');
  const [openTs, setOpenTs] = useState<string | null>(null);

  // Latest summary per parent ts. The history list is small (capped at 50)
  // and only mutates on user action, so a per-render scan is cheap.
  const summaryByTs = useMemo(() => {
    const map = new Map<string, DigestHistoryItem>();
    for (const h of props.history) {
      if (h.channelId !== props.channelId || !h.threadTs) continue;
      if (!map.has(h.threadTs)) map.set(h.threadTs, h);
    }
    return map;
  }, [props.history, props.channelId]);

  // Channel switch should reset transient view state.
  useEffect(() => {
    setOpenTs(null);
    setQuery('');
  }, [props.channelId]);

  if (cacheQ.isLoading) return <Card><Hint>로딩 중…</Hint></Card>;
  if (!cacheQ.data) return <Card><Hint>(데이터 없음)</Hint></Card>;
  if (!cacheQ.data.ok) return <Card><Err>{cacheQ.data.error}</Err></Card>;

  const cache = cacheQ.data.cache;
  const filtered = cache.threads.filter((t) => {
    if (filter === 'bracket' && !t.isTopic) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.text.toLowerCase().includes(q) ||
      t.userName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-2">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-ink-300">
            <span className="font-semibold text-ink-100">#{cache.channelName}</span>
            <span className="text-ink-500">
              · {cache.threads.length} 스레드 · 최근 {cache.days}일
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {(['bracket', 'all'] as TopicFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded border px-2 py-0.5 text-[10px] transition ${
                  filter === f
                    ? 'border-emerald-600/60 bg-emerald-600/20 text-emerald-200'
                    : 'border-ink-700 text-ink-300 hover:bg-ink-850'
                }`}
              >
                {f === 'bracket' ? '[주제] 만' : '모든 스레드'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목/작성자 검색"
            className={INPUT_CLASS}
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card><Hint>(매칭되는 스레드 없음)</Hint></Card>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {filtered.map((t) => (
            <ThreadItem
              key={t.ts}
              channelId={cache.channelId}
              channelName={cache.channelName}
              parent={t}
              open={openTs === t.ts}
              onToggle={() => setOpenTs((cur) => (cur === t.ts ? null : t.ts))}
              existingSummary={summaryByTs.get(t.ts) ?? null}
              addHistoryAndOpen={props.addHistoryAndOpen}
              openExistingSummary={props.openExistingSummary}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ThreadItem(props: {
  channelId: string;
  channelName: string;
  parent: SlackThreadParent;
  open: boolean;
  onToggle: () => void;
  existingSummary: DigestHistoryItem | null;
  addHistoryAndOpen: (item: DigestHistoryItem) => void;
  openExistingSummary: (id: string) => void;
}) {
  const {
    channelId,
    channelName,
    parent,
    open,
    onToggle,
    existingSummary,
    addHistoryAndOpen,
    openExistingSummary,
  } = props;
  const qc = useQueryClient();
  const loadM = useMutation(slackMutations.loadThreadReplies());
  const summarizeM = useMutation(slackMutations.summarize());
  const needsFetch = parent.repliesLoadedAt === null && parent.replyCount > 0;
  const [template, setTemplate] = useState<SlackSummaryTemplate>(() =>
    loadPreferredTemplate(),
  );
  useEffect(() => {
    savePreferredTemplate(template);
  }, [template]);

  const onSummarize = () => {
    if (summarizeM.isPending) return;
    // Thread mode: Slack's conversations.replies has no oldest/latest window,
    // so a wide window (0 ~ now) lets the service pull the whole thread.
    summarizeM.mutate(
      {
        channelId,
        threadTs: parent.ts,
        fromUnix: 0,
        toUnix: Math.floor(Date.now() / 1000),
        template,
      },
      {
        onSuccess: (data) => {
          const id = randomId();
          const item: DigestHistoryItem = {
            id,
            at: Date.now(),
            channelId,
            channelLabel: channelName,
            threadTs: parent.ts,
            focus: '',
            template,
            result: data.ok
              ? {
                  ok: true,
                  channelName: data.channelName,
                  messageCount: data.messageCount,
                  summary: data.summary,
                }
              : { ok: false, error: data.error },
          };
          addHistoryAndOpen(item);
        },
        onError: (err) => {
          const id = randomId();
          addHistoryAndOpen({
            id,
            at: Date.now(),
            channelId,
            channelLabel: channelName,
            threadTs: parent.ts,
            focus: '',
            template,
            result: {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        },
      },
    );
  };

  useEffect(() => {
    if (!open || !needsFetch || loadM.isPending) return;
    loadM.mutate(
      { channelId, threadTs: parent.ts },
      {
        onSuccess: (data) => {
          if (data.ok) {
            // Patch the cached channel snapshot so the new replies persist
            // across re-renders without another disk round-trip.
            qc.setQueryData(
              slackKeys.threadChannel(channelId),
              (
                prev:
                  | { ok: true; cache: { threads: SlackThreadParent[] } }
                  | { ok: false; error: string }
                  | undefined,
              ) => {
                if (!prev || !prev.ok) return prev;
                return {
                  ...prev,
                  cache: {
                    ...prev.cache,
                    threads: prev.cache.threads.map((t) =>
                      t.ts === data.thread.ts ? data.thread : t,
                    ),
                  },
                };
              },
            );
          }
        },
      },
    );
    // We only want to fire the fetch on the open→true transition, not on each
    // mutation-state change. The mutation itself guards re-entry via isPending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, needsFetch]);

  const loadingReplies = loadM.isPending && needsFetch;
  const loadError = loadM.data && !loadM.data.ok ? loadM.data.error : null;
  const firstLine = parent.text.split('\n')[0] || '(빈 메시지)';
  return (
    <li className="overflow-hidden rounded border border-ink-800 bg-ink-900/40">
      <div className="flex items-start gap-2 px-3 py-2 text-[12px] hover:bg-ink-850">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <span className="mt-0.5 shrink-0 text-ink-500">{open ? '▼' : '▶'}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 truncate font-medium text-ink-100">
              <span className="truncate">{firstLine}</span>
              {existingSummary?.result.ok && (
                <span
                  className="shrink-0 rounded bg-emerald-600/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300"
                  title="저장된 요약 있음"
                >
                  요약됨
                </span>
              )}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-ink-500">
              <span>{parent.userName || '(unknown)'}</span>
              <span>·</span>
              <span>{new Date(parent.at).toLocaleString()}</span>
              <span>·</span>
              <span>{parent.replyCount}개 답글</span>
              {parent.permalink && (
                <a
                  href={parent.permalink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-300/80 hover:text-emerald-200"
                >
                  Slack에서 열기 ↗
                </a>
              )}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {existingSummary && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openExistingSummary(existingSummary.id);
              }}
              className="rounded border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-600/20"
              title={`마지막 요약 (${existingSummary.template ? templateLabel(existingSummary.template) : '기본'}): ${new Date(existingSummary.at).toLocaleString()}`}
            >
              📝 요약 보기
            </button>
          )}
          <select
            value={template}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              setTemplate(e.target.value as SlackSummaryTemplate);
            }}
            className="max-w-[140px] rounded border border-ink-700 bg-ink-950/60 px-1.5 py-0.5 text-[10px] text-ink-200"
            title="요약 템플릿"
          >
            {SUMMARY_TEMPLATE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.icon} {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSummarize();
            }}
            disabled={summarizeM.isPending}
            className="rounded border border-ink-700 px-2 py-0.5 text-[10px] text-ink-200 hover:bg-ink-850 disabled:opacity-50"
            title={`이 스레드를 "${templateLabel(template)}" 템플릿으로 요약합니다.`}
          >
            {summarizeM.isPending
              ? '요약 중…'
              : existingSummary
                ? '🔁 다시 요약'
                : '🚀 요약'}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-ink-800 bg-ink-950/40 p-4">
          <MessageBlock
            userName={parent.userName}
            at={parent.at}
            text={parent.text}
            tone="parent"
          />
          <div className="mt-4 border-t border-ink-800/70 pt-3">
            {loadingReplies ? (
              <Hint>답글 불러오는 중…</Hint>
            ) : loadError ? (
              <Err>{loadError}</Err>
            ) : parent.repliesLoadedAt === null ? (
              <Hint>(아직 답글을 불러오지 않음)</Hint>
            ) : parent.replies.length === 0 ? (
              <Hint>(저장된 답글 없음 — 캐시 시점에 비어있었을 수 있음)</Hint>
            ) : (
              <>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  답글 {parent.replies.length}
                </div>
                <ul className="flex flex-col gap-4">
                  {parent.replies.map((r) => (
                    <li key={r.ts}>
                      <MessageBlock
                        userName={r.userName}
                        at={r.at}
                        text={r.text}
                        tone="reply"
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function MessageBlock(props: {
  userName: string;
  at: string;
  text: string;
  tone: 'parent' | 'reply';
}) {
  const { userName, at, text, tone } = props;
  const name = userName || '(unknown)';
  const initial = name.replace(/^[@:]+/, '').trim().charAt(0).toUpperCase() || '?';
  const avatarBg = avatarColor(name);
  return (
    <div className="flex gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-ink-100 ${avatarBg}`}
        aria-hidden
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[13px] font-semibold text-ink-100">{name}</span>
          <span className="text-[10px] text-ink-500">
            {new Date(at).toLocaleString()}
          </span>
        </div>
        <div
          className={`mt-1 whitespace-pre-wrap break-words leading-[1.65] ${
            tone === 'parent' ? 'text-[13.5px] text-ink-100' : 'text-[13px] text-ink-200'
          }`}
        >
          {text || <span className="text-ink-500">(빈 메시지)</span>}
        </div>
      </div>
    </div>
  );
}

const AVATAR_PALETTE = [
  'bg-emerald-600/40',
  'bg-sky-600/40',
  'bg-violet-600/40',
  'bg-amber-600/40',
  'bg-rose-600/40',
  'bg-teal-600/40',
  'bg-indigo-600/40',
  'bg-fuchsia-600/40',
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

// ---------- TemplatePicker ----------

function TemplatePicker(props: {
  value: SlackSummaryTemplate;
  onChange: (next: SlackSummaryTemplate) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {SUMMARY_TEMPLATE_OPTIONS.map((o) => {
        const active = props.value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => props.onChange(o.key)}
            className={`flex flex-col items-start gap-0.5 rounded border px-2 py-1.5 text-left transition ${
              active
                ? 'border-emerald-600/60 bg-emerald-600/15 text-emerald-100'
                : 'border-ink-700 bg-ink-950/40 text-ink-200 hover:bg-ink-850'
            }`}
            title={o.hint}
          >
            <span className="flex items-center gap-1 text-[11px] font-semibold">
              <span>{o.icon}</span>
              <span>{o.label}</span>
            </span>
            <span className="text-[10px] text-ink-500">{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- SummaryViewer ----------

function SummaryViewer(props: { item: DigestHistoryItem }) {
  const { item } = props;
  const isThread = !!item.threadTs;
  return (
    <div className="overflow-hidden rounded-lg border border-ink-800 bg-ink-950/60">
      <header className="border-b border-ink-800 bg-ink-900/50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
              item.result.ok
                ? 'bg-emerald-600/20 text-emerald-200'
                : 'bg-rose-500/20 text-rose-200'
            }`}
          >
            {item.result.ok ? 'OK' : 'ERROR'}
          </span>
          <span className="font-semibold text-ink-100">
            #{item.result.ok ? item.result.channelName : item.channelLabel}
          </span>
          {isThread && (
            <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ink-300">
              스레드
            </span>
          )}
          {item.template && (
            <span
              className="rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-ink-200"
              title="이 요약에 사용된 템플릿"
            >
              {templateIcon(item.template)} {templateLabel(item.template)}
            </span>
          )}
          <span className="ml-auto text-[10px] text-ink-500">
            {new Date(item.at).toLocaleString()}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-ink-500">
          {item.result.ok && (
            <span>
              메시지{' '}
              <span className="text-ink-300">{item.result.messageCount}</span>개 분석
            </span>
          )}
          {item.focus && (
            <span>
              포커스: <span className="text-ink-300">{item.focus}</span>
            </span>
          )}
        </div>
      </header>
      <div className="px-4 py-3.5">
        {item.result.ok ? (
          <RenderedMarkdown text={item.result.summary} />
        ) : (
          <Err>{item.result.error}</Err>
        )}
      </div>
    </div>
  );
}

type MdBlock =
  | { kind: 'h'; level: 1 | 2 | 3; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'p'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' };

function parseMarkdownBlocks(src: string): MdBlock[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: MdBlock[] = [];
  let i = 0;
  const isHeading = (s: string) => /^(#{1,3})\s+\S/.test(s);
  const isBullet = (s: string) => /^[-*•]\s+\S/.test(s);
  const isNumbered = (s: string) => /^\d+[.)]\s+\S/.test(s);
  const isHr = (s: string) => /^(-{3,}|_{3,}|\*{3,})$/.test(s);
  const isQuote = (s: string) => /^>\s?/.test(s);
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    if (isHr(trimmed)) {
      out.push({ kind: 'hr' });
      i += 1;
      continue;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (h) {
      out.push({ kind: 'h', level: h[1].length as 1 | 2 | 3, text: h[2] });
      i += 1;
      continue;
    }
    if (isBullet(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      out.push({ kind: 'ul', items });
      continue;
    }
    if (isNumbered(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && isNumbered(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      out.push({ kind: 'ol', items });
      continue;
    }
    if (isQuote(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && isQuote(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      out.push({ kind: 'quote', text: buf.join('\n') });
      continue;
    }
    // Paragraph: consecutive non-empty, non-block lines.
    const buf: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t || isHeading(t) || isBullet(t) || isNumbered(t) || isHr(t) || isQuote(t)) {
        break;
      }
      buf.push(lines[i]);
      i += 1;
    }
    out.push({ kind: 'p', text: buf.join('\n') });
  }
  return out;
}

const INLINE_RE =
  /(`[^`]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)]+\))|(<https?:\/\/[^>]+>)|(https?:\/\/\S+)/g;

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      out.push(
        <code
          key={key++}
          className="rounded bg-ink-800/80 px-1 py-0.5 font-mono text-[12px] text-amber-200"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('**')) {
      out.push(
        <strong key={key++} className="font-semibold text-ink-50">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith('*')) {
      out.push(
        <em key={key++} className="italic text-ink-100">
          {tok.slice(1, -1)}
        </em>,
      );
    } else if (tok.startsWith('[')) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (lm) {
        out.push(
          <a
            key={key++}
            href={lm[2]}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            {lm[1]}
          </a>,
        );
      } else {
        out.push(tok);
      }
    } else if (tok.startsWith('<')) {
      const url = tok.slice(1, -1);
      out.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-emerald-300 underline-offset-2 hover:underline"
        >
          {url}
        </a>,
      );
    } else {
      out.push(
        <a
          key={key++}
          href={tok}
          target="_blank"
          rel="noreferrer"
          className="text-emerald-300 underline-offset-2 hover:underline break-all"
        >
          {tok}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function RenderedMarkdown(props: { text: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(props.text), [props.text]);
  return (
    <div className="flex flex-col gap-3 text-[13px] leading-[1.75] text-ink-100">
      {blocks.map((b, i) => {
        if (b.kind === 'h') {
          const cls =
            b.level === 1
              ? 'mt-1 text-[15px] font-bold text-ink-50'
              : b.level === 2
                ? 'mt-1 text-[14px] font-semibold text-ink-100'
                : 'mt-1 text-[13px] font-semibold uppercase tracking-wide text-ink-200';
          if (b.level === 1) {
            return (
              <h3 key={i} className={cls}>
                {renderInline(b.text)}
              </h3>
            );
          }
          if (b.level === 2) {
            return (
              <h4 key={i} className={cls}>
                {renderInline(b.text)}
              </h4>
            );
          }
          return (
            <h5 key={i} className={cls}>
              {renderInline(b.text)}
            </h5>
          );
        }
        if (b.kind === 'hr') {
          return <hr key={i} className="border-ink-800" />;
        }
        if (b.kind === 'ul') {
          return (
            <ul
              key={i}
              className="ml-5 list-disc space-y-1.5 marker:text-ink-500"
            >
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === 'ol') {
          return (
            <ol
              key={i}
              className="ml-5 list-decimal space-y-1.5 marker:text-ink-500"
            >
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ol>
          );
        }
        if (b.kind === 'quote') {
          return (
            <blockquote
              key={i}
              className="border-l-2 border-emerald-600/50 bg-ink-900/40 px-3 py-1.5 text-ink-200"
            >
              {renderInline(b.text)}
            </blockquote>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap break-words">
            {renderInline(b.text)}
          </p>
        );
      })}
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
