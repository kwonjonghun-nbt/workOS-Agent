import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { jiraSlackMutations } from '../../../server-state/jira/slack';

/**
 * Jira 확장의 Slack 데일리 공유 패널.
 *
 * - 설정 값(BotToken / ChannelId / 검색 텍스트 / 자동 전송 시각 / 활성화) 은
 *   Jira 확장의 settings 폼을 그대로 재사용해 `safeStorage` 로 암호화 저장.
 * - 본 컴포넌트는 그 위에 *동작 패널* 만 얹는다: 연결 테스트, 오늘의 앵커
 *   메시지 검색, 미리보기, 지금 보내기.
 */
export function JiraSlackSettings() {
  const testConn = useMutation(jiraSlackMutations.testConnection());
  const findThread = useMutation(jiraSlackMutations.findThreadMessage());
  const preview = useMutation(jiraSlackMutations.previewDailyReport());
  const sendNow = useMutation(jiraSlackMutations.sendDailyReport());

  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded border border-ink-800 bg-ink-900/50 p-3 text-xs leading-relaxed text-ink-300">
        <div className="mb-1 font-semibold text-ink-200">Slack 데일리 공유</div>
        오늘 채널에 올라온 메시지 중 검색 텍스트를 포함한 글을 찾아, 담당자별 <b>진행중 작업</b>을 컴포넌트 → 에픽 → 하위작업 구조로 <b>스레드 댓글</b>에 자동 게시합니다.
        매일 지정한 시각에 자동 실행되며, "지금 보내기"로 즉시 실행할 수도 있습니다.
        <div className="mt-2 text-ink-400">
          Bot Token · Channel ID · 검색 텍스트 · 자동 전송 시각은 좌측 <b>⚙ 설정</b> 탭의 확장 설정 폼에서 입력하세요. Bot Token 권한: <code>channels:history</code>, <code>groups:history</code>, <code>chat:write</code>
        </div>
      </div>

      <div className="rounded border border-ink-800 bg-ink-900/40 p-3">
        <div className="mb-2 text-xs font-semibold text-ink-200">동작 테스트</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => testConn.mutate({})}
            disabled={testConn.isPending}
            className="rounded border border-ink-700 px-2.5 py-1 text-xs text-ink-200 hover:bg-ink-850 disabled:opacity-50"
          >
            {testConn.isPending ? '확인 중…' : '🔌 채널 연결 테스트'}
          </button>
          <button
            type="button"
            onClick={() => findThread.mutate({})}
            disabled={findThread.isPending}
            className="rounded border border-ink-700 px-2.5 py-1 text-xs text-ink-200 hover:bg-ink-850 disabled:opacity-50"
          >
            {findThread.isPending ? '검색 중…' : '🔎 오늘 앵커 메시지 찾기'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowPreview(true);
              preview.mutate();
            }}
            disabled={preview.isPending}
            className="rounded border border-ink-700 px-2.5 py-1 text-xs text-ink-200 hover:bg-ink-850 disabled:opacity-50"
          >
            {preview.isPending ? '생성 중…' : '👀 메시지 미리보기'}
          </button>
          <button
            type="button"
            onClick={() => sendNow.mutate()}
            disabled={sendNow.isPending}
            className="rounded border border-emerald-700/60 bg-emerald-700/20 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-700/30 disabled:opacity-50"
          >
            {sendNow.isPending ? '전송 중…' : '🚀 지금 보내기'}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-1.5 text-[11px]">
          {testConn.data && (
            <ResultLine
              ok={testConn.data.ok}
              text={
                testConn.data.ok
                  ? '채널에 접근할 수 있습니다.'
                  : `채널 접근 실패: ${testConn.data.error}`
              }
            />
          )}
          {findThread.data && (
            <ResultLine
              ok={findThread.data.ok && (findThread.data as { found?: boolean }).found !== false}
              text={
                findThread.data.ok
                  ? findThread.data.found
                    ? `앵커 메시지 발견 (ts=${findThread.data.ts}): "${truncate(findThread.data.text, 80)}"`
                    : '오늘 해당 텍스트를 포함한 메시지가 아직 없습니다.'
                  : `검색 실패: ${findThread.data.error}`
              }
            />
          )}
          {sendNow.data && (
            <ResultLine
              ok={sendNow.data.ok}
              text={
                sendNow.data.ok
                  ? `${sendNow.data.sentCount}명 분의 리포트를 스레드(ts=${sendNow.data.threadTs})에 게시했습니다.`
                  : `전송 실패: ${sendNow.data.error}`
              }
            />
          )}
        </div>
      </div>

      {showPreview && preview.data && (
        <div className="rounded border border-ink-800 bg-ink-900/40 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-200">
            <span>미리보기</span>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="text-ink-500 hover:text-ink-300"
            >
              닫기 ✕
            </button>
          </div>
          {preview.data.ok ? (
            preview.data.entries.length === 0 ? (
              <div className="text-[11px] text-ink-400">
                진행중인 작업이 있는 담당자가 없습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {preview.data.entries.map((e) => (
                  <pre
                    key={e.assignee}
                    className="whitespace-pre-wrap rounded border border-ink-800 bg-ink-950/60 p-2 text-[11px] leading-relaxed text-ink-200"
                  >
                    {e.message}
                  </pre>
                ))}
              </div>
            )
          ) : (
            <div className="text-[11px] text-rose-300">
              {preview.data.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={`rounded border px-2 py-1 ${
        ok
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
      }`}
    >
      {text}
    </div>
  );
}

function truncate(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n)}…` : text;
}
