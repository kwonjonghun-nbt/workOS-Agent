import { mutationOptions } from '@tanstack/react-query';
import { extensionApi } from '../../api/extension';
import type {
  ExtensionListItem,
  SetEnabledRequest,
  UpdateSettingsRequest,
} from '../../api/extension';

// Cache invalidation flows through the broadcast `extension:changed` event in
// events.ts → setQueryData. No onSuccess-invalidate here.

const setEnabled = mutationOptions<ExtensionListItem, Error, SetEnabledRequest>({
  mutationFn: (req) => extensionApi.setEnabled(req),
});

const updateSettings = mutationOptions<ExtensionListItem, Error, UpdateSettingsRequest>({
  mutationFn: (req) => extensionApi.updateSettings(req),
});

export const extensionMutations = {
  setEnabled: () => setEnabled,
  updateSettings: () => updateSettings,
};
