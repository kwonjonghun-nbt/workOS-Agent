import { workOSApi } from '../../api/workOS';
import type { WorkOSChangedEvent } from '../../api/workOS';

export const workOSEvents = {
  subscribeChanged: (l: (e: WorkOSChangedEvent) => void) => workOSApi.onChanged(l),
};

export type { WorkOSChangedEvent };
