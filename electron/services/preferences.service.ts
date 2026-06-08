import type { PreferencesRepository } from '../repositories/preferences.repo';
import type { Preferences, SessionGateMode, ThemeMode } from '../contracts/preferences';

export class PreferencesService {
  private cache: Preferences;

  constructor(private readonly repo: PreferencesRepository) {
    this.cache = this.repo.load();
  }

  getAll(): Preferences {
    return this.cache;
  }

  async setTheme(theme: ThemeMode): Promise<void> {
    this.cache = { ...this.cache, theme };
    await this.repo.save(this.cache);
  }

  /** SessionStart Jira 게이트 on/off. 기본(undefined)은 on. */
  isSessionGateEnabled(): boolean {
    return this.cache.sessionGateHook !== false;
  }

  async setSessionGateHook(enabled: boolean): Promise<void> {
    this.cache = { ...this.cache, sessionGateHook: enabled };
    await this.repo.save(this.cache);
  }

  /** 게이트 트리거 모드. 기본(undefined)은 'always'. */
  getSessionGateMode(): SessionGateMode {
    return this.cache.sessionGateMode ?? 'always';
  }

  async setSessionGateMode(mode: SessionGateMode): Promise<void> {
    this.cache = { ...this.cache, sessionGateMode: mode };
    await this.repo.save(this.cache);
  }
}
