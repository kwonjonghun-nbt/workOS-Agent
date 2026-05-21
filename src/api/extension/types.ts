// Type-only mirrors of electron/contracts/extension.ts.

export type ExtensionViewBodyBlock =
  | { type: 'markdown'; value: string }
  | { type: 'settings' }
  | { type: 'custom'; component: string };

export type ExtensionView = {
  id: string;
  title: string;
  icon: string;
  body: ExtensionViewBodyBlock[];
};

export type SettingsField =
  | { type: 'string'; title: string; description?: string; default?: string; enum?: string[] }
  | {
      type: 'number';
      title: string;
      description?: string;
      default?: number;
      min?: number;
      max?: number;
    }
  | { type: 'boolean'; title: string; description?: string; default?: boolean }
  | { type: 'secret'; title: string; description?: string; default?: string };

export type EventHookEvent = 'terminal:exit';

export type EventHookAction = {
  type: 'notify';
  level: 'info' | 'warn' | 'error';
  message: string;
};

export type EventHook = {
  on: EventHookEvent;
  when?: Record<string, string | number | boolean>;
  do: EventHookAction;
};

export type ExtensionManifest = {
  manifestVersion: 1;
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  contributes: {
    views: ExtensionView[];
    settings?: { schema: Record<string, SettingsField> };
    eventHooks: EventHook[];
  };
};

export type ExtensionListItem = {
  manifest: ExtensionManifest;
  enabled: boolean;
  settings: Record<string, string | number | boolean>;
};

export type SetEnabledRequest = { id: string; enabled: boolean };
export type UpdateSettingsRequest = {
  id: string;
  settings: Record<string, string | number | boolean>;
};

export type ExtensionsChangedEvent = { extensions: ExtensionListItem[] };
