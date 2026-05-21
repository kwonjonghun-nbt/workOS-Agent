import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  extensionEvents,
  extensionKeys,
  extensionMutations,
  extensionQueries,
} from '../../server-state/extension';

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
