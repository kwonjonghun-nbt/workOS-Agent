import type { PreferencesRepository } from '../repositories/preferences.repo';
import type { Preferences, ThemeMode } from '../contracts/preferences';

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
}
