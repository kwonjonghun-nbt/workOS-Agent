import { extensionApi } from '../../api/extension';
import type { ExtensionsChangedEvent } from '../../api/extension';

export const extensionEvents = {
  subscribeChanged: (listener: (event: ExtensionsChangedEvent) => void) =>
    extensionApi.onChanged(listener),
};

export type { ExtensionsChangedEvent };
