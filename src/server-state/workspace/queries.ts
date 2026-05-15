import { queryOptions } from '@tanstack/react-query';
import { workspaceApi } from '../../api/workspace';
import { workspaceKeys } from './keys';

export const workspaceQueries = {
  list: () =>
    queryOptions({
      queryKey: workspaceKeys.list(),
      queryFn: () => workspaceApi.list(),
    }),
};
