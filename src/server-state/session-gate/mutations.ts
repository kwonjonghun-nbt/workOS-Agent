import { mutationOptions } from '@tanstack/react-query';
import { sessionGateApi } from '../../api/session-gate';

export const sessionGateMutations = {
  resolve: () =>
    mutationOptions({
      mutationKey: ['sessionGate', 'resolve'] as const,
      mutationFn: sessionGateApi.resolve,
    }),
};
