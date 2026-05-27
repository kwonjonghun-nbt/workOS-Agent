/**
 * Drop-in replacement for `window.localStorage`, but persisted by the main
 * process at `userData/local-store.json`. Survives Electron's file:// quirks
 * and is reliable across reloads/restarts.
 *
 * The whole snapshot is pulled once via a synchronous IPC call on first use,
 * then mirrored in this module's `cache`. Reads stay synchronous (matching
 * the `localStorage` API); writes update the cache immediately and fire an
 * async IPC write — the renderer never has to await persistence.
 */

const api = () => window.electronAPI.localStore;

let cache: Record<string, string> | null = null;

function ensureCache(): Record<string, string> {
  if (cache) return cache;
  try {
    cache = { ...api().getAllSync() };
  } catch {
    cache = {};
  }
  migrateLegacyLocalStorage(cache);
  return cache;
}

/**
 * Keys we used to read/write via window.localStorage. Copy them into the new
 * disk-backed store the first time the cache is materialized, then wipe the
 * old localStorage entries so we never read from there again.
 *
 * The theme key (`workos-agent.theme`) is intentionally excluded — theme is
 * owned by `preferences.json` via PreferencesService, not by local-store.
 */
const LEGACY_LOCAL_STORAGE_KEYS = [
  'workos.slack.channels.v1',
  'workos.slack.summaryTemplate.v1',
  'slack.digest.history.v1',
  'workOS:tasks:viewMode',
];

let migrated = false;
function migrateLegacyLocalStorage(target: Record<string, string>): void {
  if (migrated) return;
  migrated = true;
  if (typeof window === 'undefined' || !window.localStorage) return;
  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    try {
      const legacy = window.localStorage.getItem(key);
      if (legacy == null) continue;
      // Don't overwrite values already in the new store.
      if (target[key] === undefined) {
        target[key] = legacy;
        void api().set({ key, value: legacy });
      }
      window.localStorage.removeItem(key);
    } catch {
      /* localStorage may be unavailable — fine to ignore */
    }
  }
}

export function getLocal(key: string): string | null {
  return ensureCache()[key] ?? null;
}

export function setLocal(key: string, value: string): void {
  ensureCache()[key] = value;
  void api().set({ key, value });
}

export function removeLocal(key: string): void {
  const c = ensureCache();
  if (!(key in c)) return;
  delete c[key];
  void api().remove({ key });
}
