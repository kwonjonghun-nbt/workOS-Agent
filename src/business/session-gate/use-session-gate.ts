import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  sessionGateEvents,
  sessionGateMutations,
  type SessionGateIssue,
  type SessionGateOpenEvent,
} from '../../server-state/session-gate';
import { jiraMutations, type CreateIssueRequest } from '../../server-state/jira';
import { branchMutations } from '../../server-state/branch';
import { useRecentTicketsStore } from './recent-tickets-store';

/** 생성 폼 입력. issueTypeName 은 브랜치 생성 시 Epic/Bug 판별에 쓰인다. */
export type SessionGateCreateForm = CreateIssueRequest & { issueTypeName: string };

/**
 * Session-Start Jira Gate use-case.
 *
 * Subscribes to the host's open/close events (a claude session is starting and
 * blocking on the gate) and exposes the three resolutions. `create` composes
 * the Jira create mutation with the gate resolve so the new ticket exists
 * before the session proceeds. Mounted once at the app root.
 */
export function useSessionGate() {
  const [active, setActive] = useState<SessionGateOpenEvent | null>(null);
  const resolveM = useMutation(sessionGateMutations.resolve());
  const createM = useMutation(jiraMutations.createIssue());
  const branchM = useMutation(branchMutations.createForTicket());
  const addRecent = useRecentTicketsStore((s) => s.add);

  // git 실패로 브랜치 생성이 막히면 게이트가 열린 채 재시도된다. 이미 만든 티켓을
  // 다시 만들지 않도록 현재 게이트에서 생성한 이슈를 캐시한다.
  const createdRef = useRef<{ requestId: string; issue: SessionGateIssue } | null>(null);

  useEffect(() => {
    const offOpen = sessionGateEvents.subscribeOpen((evt) => setActive(evt));
    const offClose = sessionGateEvents.subscribeClose((evt) =>
      setActive((cur) => (cur && cur.requestId === evt.requestId ? null : cur)),
    );
    return () => {
      offOpen();
      offClose();
    };
  }, []);

  const skip = useCallback(async () => {
    if (!active) return;
    await resolveM.mutateAsync({ requestId: active.requestId, choice: 'skip' });
    createdRef.current = null;
    setActive(null);
  }, [active, resolveM]);

  const selectExisting = useCallback(
    async (issue: SessionGateIssue) => {
      if (!active) return;
      await resolveM.mutateAsync({ requestId: active.requestId, choice: 'select', issue });
      addRecent(issue);
      createdRef.current = null;
      setActive(null);
    },
    [active, resolveM, addRecent],
  );

  const createAndUse = useCallback(
    async (form: SessionGateCreateForm) => {
      if (!active) return;

      // 1) 티켓 — 이미 이 게이트에서 만들었으면 재사용(브랜치 실패 후 재시도 시 중복 생성 방지).
      let issue =
        createdRef.current?.requestId === active.requestId ? createdRef.current.issue : null;
      if (!issue) {
        const created = await createM.mutateAsync(form);
        issue = { key: created.key, summary: form.summary, url: created.url };
        createdRef.current = { requestId: active.requestId, issue };
      }

      // 2) feature 브랜치 생성/체크아웃. Epic/Bug 는 main 에서 skip(비치명적).
      //    git 실패 시 throw → 아래 resolve 에 도달하지 못해 게이트가 열린 채 세션이 차단된다.
      await branchM.mutateAsync({
        workspaceId: active.workspaceId,
        ticketKey: issue.key,
        summary: form.summary,
        issueTypeName: form.issueTypeName,
      });

      // 3) 게이트 resolve — 세션 시작.
      await resolveM.mutateAsync({ requestId: active.requestId, choice: 'create', issue });
      addRecent(issue);
      createdRef.current = null;
      setActive(null);
    },
    [active, createM, branchM, resolveM, addRecent],
  );

  return {
    active,
    submitting: resolveM.isPending || createM.isPending || branchM.isPending,
    createError: (createM.error ?? branchM.error) as Error | null,
    skip,
    selectExisting,
    createAndUse,
  };
}
