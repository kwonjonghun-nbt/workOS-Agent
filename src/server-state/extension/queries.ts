import { queryOptions } from '@tanstack/react-query';
import { extensionApi } from '../../api/extension';
import { extensionKeys } from './keys';

export const extensionQueries = {
  list: () =>
    queryOptions({
      queryKey: extensionKeys.list(),
      queryFn: () => extensionApi.list(),
    }),
};
