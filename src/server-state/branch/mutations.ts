import { mutationOptions } from '@tanstack/react-query';
import { branchApi } from '../../api/branch';

export const branchMutations = {
  createForTicket: () =>
    mutationOptions({
      mutationKey: ['branch', 'createForTicket'] as const,
      mutationFn: branchApi.createForTicket,
    }),
};
