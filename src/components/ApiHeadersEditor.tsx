import type { ApiHeaderRow } from "@/types/apiTester";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { ToggleSwitch } from "@/components/ToggleSwitch";

type Props = {
  rows: ApiHeaderRow[];
  onChange: (rows: ApiHeaderRow[]) => void;
};

/** Key/value rows for request headers — each can be toggled off without deleting it,
 * so you can temporarily disable e.g. Authorization without retyping it later. */
export function ApiHeadersEditor({ rows, onChange }: Props) {
  const update = (id: string, patch: Partial<ApiHeaderRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    onChange([
      ...rows,
      { id: crypto.randomUUID(), key: "", value: "", enabled: true },
    ]);

  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id));

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && (
        <p className="text-xs text-stone">No headers yet.</p>
      )}
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <ToggleSwitch
            checked={row.enabled}
            onChange={(enabled) => update(row.id, { enabled })}
            label="Enable header"
          />
          <input
            value={row.key}
            onChange={(e) => update(row.id, { key: e.target.value })}
            placeholder="Header"
            className="w-40 min-w-0 rounded-md border border-linen bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent"
          />
          <input
            value={row.value}
            onChange={(e) => update(row.id, { value: e.target.value })}
            placeholder="Value"
            className="min-w-0 flex-1 rounded-md border border-linen bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => removeRow(row.id)}
            aria-label="Remove header"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-stone hover:bg-linen-hover hover:text-ink"
          >
            <TrashIcon className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-linen-hover"
      >
        <PlusIcon className="size-3.5" />
        Add header
      </button>
    </div>
  );
}
