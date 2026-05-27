import { z } from 'zod';

/**
 * Generic key-value store backed by `userData/local-store.json` on disk.
 * Replaces renderer-side `localStorage` so user settings/caches survive even
 * when Electron's file:// localStorage is cleared (e.g., by upgrade or by
 * Electron's own quirks).
 */
export const LocalStoreSetRequestSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});
export type LocalStoreSetRequest = z.infer<typeof LocalStoreSetRequestSchema>;

export const LocalStoreRemoveRequestSchema = z.object({
  key: z.string().min(1),
});
export type LocalStoreRemoveRequest = z.infer<
  typeof LocalStoreRemoveRequestSchema
>;

export type LocalStoreSnapshot = Record<string, string>;
