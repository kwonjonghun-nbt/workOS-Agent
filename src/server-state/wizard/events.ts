import { wizardApi } from '../../api/wizard';
import type { WizardUpdatedEvent } from '../../api/wizard';

export const wizardEvents = {
  subscribeUpdated: (l: (e: WizardUpdatedEvent) => void) => wizardApi.onUpdated(l),
};

export type { WizardUpdatedEvent };
