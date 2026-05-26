import { queryOptions } from '@tanstack/react-query';
import { wizardApi } from '../../api/wizard';
import { wizardKeys } from './keys';

export const wizardQueries = {
  session: (workspaceId: string) =>
    queryOptions({
      queryKey: wizardKeys.session(workspaceId),
      queryFn: () => wizardApi.get({ workspaceId }),
      enabled: Boolean(workspaceId),
    }),
};
