import { z } from 'zod';

/**
 * Extension manifest v1 — declarative only. Extensions are first-party,
 * bundled with the app; there is no remote install path.
 *
 * Capabilities:
 *  - views          : sidebar panels contributed to the activity bar
 *  - settings.schema: JSON-Schema-lite user settings rendered as a form
 *  - eventHooks     : declarative reactions to host events (e.g. terminal:exit)
 */

// ---------- views ----------

export const extensionViewBodyBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('markdown'), value: z.string() }),
  z.object({ type: z.literal('settings') }),
  z.object({
    type: z.literal('custom'),
    component: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9._-]*$/),
  }),
]);
export type ExtensionViewBodyBlock = z.infer<typeof extensionViewBodyBlockSchema>;

export const extensionViewSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9._-]*$/),
  title: z.string().min(1).max(64),
  icon: z.string().min(1).max(4),
  body: z.array(extensionViewBodyBlockSchema).default([]),
});
export type ExtensionView = z.infer<typeof extensionViewSchema>;

// ---------- settings (JSON-Schema-lite) ----------

const settingsFieldBase = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
});

export const settingsFieldSchema = z.discriminatedUnion('type', [
  settingsFieldBase.extend({
    type: z.literal('string'),
    default: z.string().optional(),
    enum: z.array(z.string()).min(1).optional(),
  }),
  settingsFieldBase.extend({
    type: z.literal('number'),
    default: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  settingsFieldBase.extend({
    type: z.literal('boolean'),
    default: z.boolean().optional(),
  }),
  settingsFieldBase.extend({
    type: z.literal('secret'),
    default: z.string().optional(),
  }),
]);
export type SettingsField = z.infer<typeof settingsFieldSchema>;

export const extensionSettingsSchema = z.object({
  schema: z.record(z.string().min(1).max(64), settingsFieldSchema),
});
export type ExtensionSettingsSpec = z.infer<typeof extensionSettingsSchema>;

// ---------- event hooks ----------

export const eventHookEventSchema = z.enum(['terminal:exit']);
export type EventHookEvent = z.infer<typeof eventHookEventSchema>;

export const eventHookWhenSchema = z
  .record(z.string().min(1).max(64), z.union([z.string(), z.number(), z.boolean()]))
  .optional();

export const eventHookActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('notify'),
    level: z.enum(['info', 'warn', 'error']).default('info'),
    message: z.string().min(1).max(500),
  }),
]);
export type EventHookAction = z.infer<typeof eventHookActionSchema>;

export const eventHookSchema = z.object({
  on: eventHookEventSchema,
  when: eventHookWhenSchema,
  do: eventHookActionSchema,
});
export type EventHook = z.infer<typeof eventHookSchema>;

// ---------- manifest root ----------

export const extensionManifestSchema = z.object({
  manifestVersion: z.literal(1),
  id: z
    .string()
    .min(3)
    .max(128)
    .regex(/^[a-z0-9][a-z0-9._-]*$/, 'id must be lowercase kebab/dot'),
  name: z.string().min(1).max(80),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/, 'version must be semver-like'),
  description: z.string().max(500).default(''),
  author: z.string().max(120).optional(),
  homepage: z.string().url().optional(),
  contributes: z
    .object({
      views: z.array(extensionViewSchema).default([]),
      settings: extensionSettingsSchema.optional(),
      eventHooks: z.array(eventHookSchema).default([]),
    })
    .default({ views: [], eventHooks: [] }),
});
export type ExtensionManifest = z.infer<typeof extensionManifestSchema>;

// ---------- listing shape (catalog manifest + per-user state) ----------

export type ExtensionListItem = {
  manifest: ExtensionManifest;
  enabled: boolean;
  settings: Record<string, string | number | boolean>;
};

// ---------- IPC requests/responses ----------

export const setEnabledRequestSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});
export type SetEnabledRequest = z.infer<typeof setEnabledRequestSchema>;

export const updateSettingsRequestSchema = z.object({
  id: z.string().min(1),
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;

export type ExtensionsChangedEvent = {
  extensions: ExtensionListItem[];
};
