import type {
  ExtensionOpenPanelEvent,
  ExtensionsChangedEvent,
  SetEnabledRequest,
  UpdateSettingsRequest,
} from './types';

function api() {
  return window.electronAPI.extension;
}

export const extensionApi = {
  list: () => api().list(),
  setEnabled: (req: SetEnabledRequest) => api().setEnabled(req),
  updateSettings: (req: UpdateSettingsRequest) => api().updateSettings(req),
  onChanged: (listener: (event: ExtensionsChangedEvent) => void) => api().onChanged(listener),
  onOpenPanel: (listener: (event: ExtensionOpenPanelEvent) => void) =>
    api().onOpenPanel(listener),
};

export type {
  ExtensionListItem,
  ExtensionManifest,
  ExtensionOpenPanelEvent,
  ExtensionView,
  ExtensionViewBodyBlock,
  ExtensionsChangedEvent,
  EventHook,
  EventHookAction,
  EventHookEvent,
  SetEnabledRequest,
  SettingsField,
  UpdateSettingsRequest,
} from './types';
