import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  extensionEvents,
  extensionKeys,
  extensionMutations,
  extensionQueries,
} from '../../server-state/extension';
import { useExtensionStore, viewKey } from './extension-store';

/** Catalog + per-user state, kept in sync with main via push events. */
export function useExtensionList() {
  const queryClient = useQueryClient();
  const query = useQuery(extensionQueries.list());

  useEffect(() => {
    const off = extensionEvents.subscribeChanged((evt) => {
      queryClient.setQueryData(extensionKeys.list(), evt.extensions);
    });
    return off;
  }, [queryClient]);

  // Auto-open the extension UI when the host signals (e.g. an AI run started
  // and the user should see the visible terminal panel).
  const setActiveView = useExtensionStore((s) => s.setActiveView);
  const setTerminalOpen = useExtensionStore((s) => s.setTerminalOpen);
  const setActiveTerminal = useExtensionStore((s) => s.setActiveTerminal);
  useEffect(() => {
    const off = extensionEvents.subscribeOpenPanel((evt) => {
      const list = queryClient.getQueryData(extensionKeys.list()) as
        | { manifest: { id: string; contributes: { views: { id: string }[] } } }[]
        | undefined;
      const target = list?.find((e) => e.manifest.id === evt.extensionId);
      const firstView = target?.manifest.contributes.views[0];
      if (firstView) {
        setActiveView(viewKey(evt.extensionId, firstView.id));
      }
      setTerminalOpen(evt.extensionId, true);
      setActiveTerminal(evt.extensionId, evt.sessionId);
    });
    return off;
  }, [queryClient, setActiveView, setTerminalOpen, setActiveTerminal]);

  return query;
}

export function useSetExtensionEnabled() {
  const m = useMutation(extensionMutations.setEnabled());
  return (id: string, enabled: boolean) => m.mutateAsync({ id, enabled });
}

export function useUpdateExtensionSettings() {
  const m = useMutation(extensionMutations.updateSettings());
  return (id: string, settings: Record<string, string | number | boolean>) =>
    m.mutateAsync({ id, settings });
}
