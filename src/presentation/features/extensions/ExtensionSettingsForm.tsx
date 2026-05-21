import { useEffect, useState } from 'react';
import {
  useExtensionList,
  useUpdateExtensionSettings,
} from '../../../business/extension/use-extensions';
import type { SettingsField } from '../../../server-state/extension';

type Value = string | number | boolean;

/**
 * Renders an extension's settings as a form derived from its declared
 * JSON-Schema-lite. Changes are persisted via IPC and the form re-derives from
 * server state on the next push event.
 */
export function ExtensionSettingsForm({ extensionId }: { extensionId: string }) {
  const extQuery = useExtensionList();
  const ext = extQuery.data?.find((e) => e.manifest.id === extensionId);
  const update = useUpdateExtensionSettings();

  const [draft, setDraft] = useState<Record<string, Value>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ext) setDraft(ext.settings);
  }, [ext]);

  if (!ext) return <div className="text-xs text-ink-500">확장을 찾을 수 없습니다.</div>;

  const schema = ext.manifest.contributes.settings?.schema;
  if (!schema || Object.keys(schema).length === 0) {
    return <div className="text-xs text-ink-500">이 확장은 설정을 제공하지 않습니다.</div>;
  }

  const onChange = (key: string, value: Value) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const onSave = async () => {
    setErr(null);
    try {
      await update(extensionId, draft);
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex flex-col gap-3 text-xs">
      {Object.entries(schema).map(([key, field]) => (
        <FieldRow
          key={key}
          fieldKey={key}
          field={field}
          value={draft[key]}
          onChange={(v) => onChange(key, v)}
        />
      ))}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onSave()}
          className="rounded bg-claude-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-claude-400"
        >
          저장
        </button>
        {savedAt && (
          <span className="text-[11px] text-emerald-400">저장됨 · {new Date(savedAt).toLocaleTimeString()}</span>
        )}
      </div>
      {err && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-[11px] text-rose-300">
          {err}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string;
  field: SettingsField;
  value: Value | undefined;
  onChange: (v: Value) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ink-200">{field.title}</span>
      {field.description && (
        <span className="text-[11px] text-ink-500">{field.description}</span>
      )}
      <FieldInput
        fieldKey={fieldKey}
        field={field}
        value={value}
        onChange={onChange}
      />
    </label>
  );
}

function FieldInput({
  fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string;
  field: SettingsField;
  value: Value | undefined;
  onChange: (v: Value) => void;
}) {
  const cls =
    'rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-100 focus:border-claude-500 focus:outline-none';

  if (field.type === 'string') {
    if (field.enum) {
      return (
        <select
          name={fieldKey}
          value={(value as string) ?? field.default ?? field.enum[0]}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        >
          {field.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        name={fieldKey}
        type="text"
        value={(value as string) ?? field.default ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
      />
    );
  }
  if (field.type === 'secret') {
    return (
      <input
        name={fieldKey}
        type="password"
        autoComplete="off"
        value={(value as string) ?? field.default ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
        placeholder="••••••••"
      />
    );
  }
  if (field.type === 'number') {
    return (
      <input
        name={fieldKey}
        type="number"
        value={value === undefined ? (field.default ?? '') : Number(value)}
        min={field.min}
        max={field.max}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cls}
      />
    );
  }
  // boolean
  return (
    <input
      name={fieldKey}
      type="checkbox"
      checked={Boolean(value ?? field.default ?? false)}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 self-start accent-claude-500"
    />
  );
}
