import { z } from 'zod';

export const ThemeModeSchema = z.enum(['dark', 'light']);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const PreferencesSchema = z.object({
  theme: ThemeModeSchema.optional(),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const SetThemeRequestSchema = z.object({
  theme: ThemeModeSchema,
});
export type SetThemeRequest = z.infer<typeof SetThemeRequestSchema>;
