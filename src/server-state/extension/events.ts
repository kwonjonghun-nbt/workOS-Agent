import { extensionApi } from '../../api/extension';
import type {
  ExtensionOpenPanelEvent,
  ExtensionsChangedEvent,
} from '../../api/extension';

export const extensionEvents = {
  subscribeChanged: (listener: (event: ExtensionsChangedEvent) => void) =>
    extensionApi.onChanged(listener),
  subscribeOpenPanel: (listener: (event: ExtensionOpenPanelEvent) => void) =>
    extensionApi.onOpenPanel(listener),
};

export type { ExtensionsChangedEvent, ExtensionOpenPanelEvent };
