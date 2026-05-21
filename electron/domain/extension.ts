import {
  extensionManifestSchema,
  type ExtensionManifest,
  type SettingsField,
} from '../contracts/extension';

export class ExtensionDomainError extends Error {
  constructor(
    public readonly code: 'INVALID_MANIFEST' | 'INVALID_SETTING',
    message: string,
  ) {
    super(message);
    this.name = 'ExtensionDomainError';
  }
}

export function parseManifest(raw: unknown): ExtensionManifest {
  const result = extensionManifestSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join('.') || '<root>';
    throw new ExtensionDomainError(
      'INVALID_MANIFEST',
      `invalid manifest at ${path}: ${first?.message ?? 'unknown error'}`,
    );
  }
  return result.data;
}

/** Coerce + validate a single setting value against its field spec. */
export function validateSettingValue(
  field: SettingsField,
  value: unknown,
): string | number | boolean {
  switch (field.type) {
    case 'string': {
      if (typeof value !== 'string') {
        throw new ExtensionDomainError('INVALID_SETTING', `expected string, got ${typeof value}`);
      }
      if (field.enum && !field.enum.includes(value)) {
        throw new ExtensionDomainError(
          'INVALID_SETTING',
          `value must be one of: ${field.enum.join(', ')}`,
        );
      }
      return value;
    }
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new ExtensionDomainError('INVALID_SETTING', `expected number, got ${typeof value}`);
      }
      if (field.min !== undefined && value < field.min) {
        throw new ExtensionDomainError('INVALID_SETTING', `value must be ≥ ${field.min}`);
      }
      if (field.max !== undefined && value > field.max) {
        throw new ExtensionDomainError('INVALID_SETTING', `value must be ≤ ${field.max}`);
      }
      return value;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        throw new ExtensionDomainError('INVALID_SETTING', `expected boolean, got ${typeof value}`);
      }
      return value;
    }
    case 'secret': {
      if (typeof value !== 'string') {
        throw new ExtensionDomainError('INVALID_SETTING', `expected string, got ${typeof value}`);
      }
      return value;
    }
  }
}

/** Returns the set of setting keys whose field type is `secret`. */
export function secretFieldKeys(manifest: ExtensionManifest): Set<string> {
  const schema = manifest.contributes.settings?.schema;
  if (!schema) return new Set();
  const out = new Set<string>();
  for (const [k, field] of Object.entries(schema)) {
    if (field.type === 'secret') out.add(k);
  }
  return out;
}

export function defaultSettings(
  manifest: ExtensionManifest,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const schema = manifest.contributes.settings?.schema;
  if (!schema) return out;
  for (const [key, field] of Object.entries(schema)) {
    if (field.default !== undefined) out[key] = field.default;
  }
  return out;
}

/**
 * Decide whether an event hook's `when` filter matches an event payload.
 * Compared values are coerced through `String()` for primitive equality so users
 * can write `{ exitCode: 0 }` or `{ exitCode: "0" }` interchangeably.
 */
export function hookMatches(
  when: Record<string, string | number | boolean> | undefined,
  event: Record<string, unknown>,
): boolean {
  if (!when) return true;
  for (const [k, expected] of Object.entries(when)) {
    const actual = event[k];
    if (actual === undefined) return false;
    if (String(actual) !== String(expected)) return false;
  }
  return true;
}

/**
 * Render `${field}` and `${settings.key}` placeholders inside a string template.
 */
export function renderTemplate(
  template: string,
  event: Record<string, unknown>,
  settings: Record<string, string | number | boolean>,
): string {
  return template.replace(/\$\{([^}]+)\}/g, (_, expr: string) => {
    const trimmed = expr.trim();
    if (trimmed.startsWith('settings.')) {
      const key = trimmed.slice('settings.'.length);
      const v = settings[key];
      return v === undefined ? '' : String(v);
    }
    const v = event[trimmed];
    return v === undefined ? '' : String(v);
  });
}

