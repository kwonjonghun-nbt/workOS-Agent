import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  sessionGateEvents,
  sessionGateMutations,
  type SessionGateIssue,
  type SessionGateOpenEvent,
} from '../../server-state/session-gate';
import { jiraMutations, type CreateIssueRequest } from '../../server-state/jira';
import { useRecentTicketsStore } from './recent-tickets-store';

export type SessionGateCreateForm = CreateIssueRequest;

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
  const addRecent = useRecentTicketsStore((s) => s.add);

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
    setActive(null);
  }, [active, resolveM]);

  const selectExisting = useCallback(
    async (issue: SessionGateIssue) => {
      if (!active) return;
      await resolveM.mutateAsync({ requestId: active.requestId, choice: 'select', issue });
      addRecent(issue);
      setActive(null);
    },
    [active, resolveM, addRecent],
  );

  const createAndUse = useCallback(
    async (form: SessionGateCreateForm) => {
      if (!active) return;
      const created = await createM.mutateAsync(form);
      const issue = { key: created.key, summary: form.summary, url: created.url };
      await resolveM.mutateAsync({
        requestId: active.requestId,
        choice: 'create',
        issue,
      });
      addRecent(issue);
      setActive(null);
    },
    [active, createM, resolveM, addRecent],
  );

  return {
    active,
    submitting: resolveM.isPending || createM.isPending,
    createError: createM.error as Error | null,
    skip,
    selectExisting,
    createAndUse,
  };
}
