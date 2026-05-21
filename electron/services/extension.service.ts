import { safeStorage } from 'electron';
import { ApiError } from '../infra/error';
import {
  defaultSettings,
  hookMatches,
  renderTemplate,
  secretFieldKeys,
  validateSettingValue,
} from '../domain/extension';
import type {
  EventHookEvent,
  ExtensionListItem,
  ExtensionManifest,
} from '../contracts/extension';
import type {
  ExtensionState,
  ExtensionStateRepository,
} from '../repositories/extension.repo';

export type ExtensionNotice = {
  extensionId: string;
  extensionName: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};

export interface ExtensionNotifier {
  notify(notice: ExtensionNotice): void;
}

/**
 * Manages the user-visible state for first-party bundled extensions.
 *
 * The catalog is injected at construction and never mutates at runtime. User
 * state (enabled + settings) is persisted under `<userData>/extensions-state.json`
 * and merged with the catalog on every `list()` call.
 */
export class ExtensionService {
  private states: Record<string, ExtensionState> | null = null;

  constructor(
    private readonly catalog: ReadonlyArray<ExtensionManifest>,
    private readonly repo: ExtensionStateRepository,
    private readonly notifier: ExtensionNotifier,
    private readonly onChanged: (list: ExtensionListItem[]) => void,
  ) {}

  private async ensureLoaded(): Promise<Record<string, ExtensionState>> {
    if (!this.states) {
      const raw = await this.repo.load();
      // Decrypt any secret fields known to the current catalog.
      for (const manifest of this.catalog) {
        const state = raw[manifest.id];
        if (!state) continue;
        const secrets = secretFieldKeys(manifest);
        for (const key of secrets) {
          const v = state.settings[key];
          if (typeof v === 'string') state.settings[key] = decryptIfNeeded(v);
        }
      }
      this.states = raw;
    }
    return this.states;
  }

  private buildList(states: Record<string, ExtensionState>): ExtensionListItem[] {
    return this.catalog.map((manifest) => {
      const persisted = states[manifest.id];
      return {
        manifest,
        enabled: persisted?.enabled ?? false,
        settings: persisted?.settings ?? defaultSettings(manifest),
      };
    });
  }

  private async persist(): Promise<void> {
    if (!this.states) return;
    // Serialize a shallow-cloned form with secret fields encrypted, so the
    // on-disk JSON never contains plain-text secrets.
    const toWrite: Record<string, ExtensionState> = {};
    for (const [id, state] of Object.entries(this.states)) {
      const manifest = this.catalog.find((c) => c.id === id);
      const secrets = manifest ? secretFieldKeys(manifest) : new Set<string>();
      const settings: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(state.settings)) {
        settings[k] = secrets.has(k) && typeof v === 'string' ? encryptForStorage(v) : v;
      }
      toWrite[id] = { enabled: state.enabled, settings };
    }
    await this.repo.save(toWrite);
    this.onChanged(this.buildList(this.states));
  }

  private requireManifest(id: string): ExtensionManifest {
    const m = this.catalog.find((c) => c.id === id);
    if (!m) throw new ApiError('NOT_FOUND', `extension not in catalog: ${id}`);
    return m;
  }

  async list(): Promise<ExtensionListItem[]> {
    const states = await this.ensureLoaded();
    return this.buildList(states);
  }

  async setEnabled(id: string, enabled: boolean): Promise<ExtensionListItem> {
    const manifest = this.requireManifest(id);
    const states = await this.ensureLoaded();
    const current = states[id];
    states[id] = {
      enabled,
      settings: current?.settings ?? defaultSettings(manifest),
    };
    await this.persist();
    return {
      manifest,
      enabled,
      settings: states[id].settings,
    };
  }

  async updateSettings(
    id: string,
    incoming: Record<string, string | number | boolean>,
  ): Promise<ExtensionListItem> {
    const manifest = this.requireManifest(id);
    const schema = manifest.contributes.settings?.schema ?? {};
    const states = await this.ensureLoaded();
    const current = states[id] ?? {
      enabled: false,
      settings: defaultSettings(manifest),
    };
    const next: Record<string, string | number | boolean> = { ...current.settings };
    for (const [key, value] of Object.entries(incoming)) {
      const field = schema[key];
      if (!field) throw new ApiError('VALIDATION', `unknown setting key: ${key}`);
      next[key] = validateSettingValue(field, value);
    }
    states[id] = { enabled: current.enabled, settings: next };
    await this.persist();
    return { manifest, enabled: states[id].enabled, settings: next };
  }

  /**
   * Dispatch a host event to every enabled extension whose hook matches.
   * Hook errors are swallowed so they cannot break the host event sink.
   */
  async dispatchEvent(event: EventHookEvent, payload: Record<string, unknown>): Promise<void> {
    const states = this.states ?? (await this.ensureLoaded());
    // If the payload carries an `ownerExtensionId`, the event originates from a
    // single extension's resources (e.g. its own terminal). In that case only
    // that extension's hooks may match — sibling extensions must not see each
    // other's terminal exit events.
    const owner =
      typeof payload.ownerExtensionId === 'string' ? payload.ownerExtensionId : null;
    for (const manifest of this.catalog) {
      if (owner && manifest.id !== owner) continue;
      const state = states[manifest.id];
      if (!state?.enabled) continue;
      for (const hook of manifest.contributes.eventHooks) {
        if (hook.on !== event) continue;
        if (!hookMatches(hook.when, payload)) continue;
        this.executeAction(manifest, state.settings, payload, hook.do);
      }
    }
  }

  /**
   * Read the merged (default + persisted, secrets decrypted) settings for a
   * specific extension. For host-side services that need user-provided
   * credentials (e.g. Jira token).
   */
  async getSettings(id: string): Promise<Record<string, string | number | boolean>> {
    const manifest = this.requireManifest(id);
    const states = await this.ensureLoaded();
    return states[id]?.settings ?? defaultSettings(manifest);
  }

  async isEnabled(id: string): Promise<boolean> {
    const states = await this.ensureLoaded();
    return states[id]?.enabled === true;
  }

  private executeAction(
    manifest: ExtensionManifest,
    settings: Record<string, string | number | boolean>,
    payload: Record<string, unknown>,
    action: ExtensionManifest['contributes']['eventHooks'][number]['do'],
  ): void {
    switch (action.type) {
      case 'notify': {
        const message = renderTemplate(action.message, payload, settings);
        this.notifier.notify({
          extensionId: manifest.id,
          extensionName: manifest.name,
          level: action.level,
          message,
        });
        return;
      }
    }
  }
}

// ---------- secret-at-rest helpers (OS keychain via safeStorage) ----------

const ENC_PREFIX = 'enc:v1:';

function encryptForStorage(plain: string): string {
  if (!plain) return plain;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = safeStorage.encryptString(plain);
      return ENC_PREFIX + buf.toString('base64');
    }
  } catch (err) {
    console.error('[extension] safeStorage encrypt failed; storing plaintext:', err);
  }
  return plain;
}

function decryptIfNeeded(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  try {
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64');
    return safeStorage.decryptString(buf);
  } catch (err) {
    console.error('[extension] safeStorage decrypt failed; treating as empty:', err);
    return '';
  }
}
