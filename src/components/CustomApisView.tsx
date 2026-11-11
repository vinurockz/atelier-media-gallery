import { useState } from "react";
import type { CustomEndpoint } from "@/types/customEndpoint";
import type {
  CustomEndpointPatch,
  NewCustomEndpoint,
} from "@/lib/api/customEndpoints";
import { customEndpointUrl } from "@/lib/api/customEndpoints";
import { CustomEndpointEditorModal } from "@/components/CustomEndpointEditorModal";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import {
  CodeIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

type Props = {
  customerId: string;
  endpoints: CustomEndpoint[];
  onCreate: (values: NewCustomEndpoint) => Promise<CustomEndpoint>;
  onPatch: (id: string, patch: CustomEndpointPatch) => void;
  onFlush: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
};

const methodColor = (method: string) =>
  method === "GET"
    ? "text-emerald-600 bg-emerald-50"
    : method === "POST"
      ? "text-amber-600 bg-amber-50"
      : method === "DELETE"
        ? "text-red-600 bg-red-50"
        : "text-accent bg-accent-soft";

/**
 * Custom APIs — your own fixed-response endpoints, each publicly callable (no login) at
 * /api/custom/<this customer's id>/<path>. Unlike the API Tester module (which calls other
 * people's APIs), this module *is* the API: pick a method, a path, a status code, and a
 * body, and it's live.
 */
export function CustomApisView({
  customerId,
  endpoints,
  onCreate,
  onPatch,
  onFlush,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState<CustomEndpoint | "new" | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleDelete = (endpoint: CustomEndpoint) => {
    if (!window.confirm(`Delete "${endpoint.name}"?`)) return;
    void onDelete(endpoint.id);
  };

  const copyUrl = async (endpoint: CustomEndpoint) => {
    try {
      await navigator.clipboard.writeText(
        customEndpointUrl(customerId, endpoint.path),
      );
      setCopiedId(endpoint.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard access denied — nothing more to do.
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <CodeIcon className="size-4 text-stone" />
          <h1 className="text-base font-medium text-ink">Custom APIs</h1>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
        >
          <PlusIcon className="size-3.5" />
          New endpoint
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
        {endpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CodeIcon className="size-10 text-neutral-300" />
            <p className="mt-3 max-w-sm text-sm text-stone">
              No custom APIs yet. Create one — pick a method, a path, and a
              response — and it's live at a real, public URL you can call from
              anywhere.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-linen bg-white px-4 py-3"
              >
                <span
                  className={`shrink-0 rounded px-2 py-1 text-[11px] font-bold ${methodColor(endpoint.method)}`}
                >
                  {endpoint.method}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {endpoint.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyUrl(endpoint)}
                    className="flex items-center gap-1 truncate text-xs text-stone hover:text-accent"
                    title="Copy URL"
                  >
                    <CopyIcon className="size-3 shrink-0" />
                    <span className="truncate">
                      {copiedId === endpoint.id
                        ? "Copied!"
                        : customEndpointUrl(customerId, endpoint.path)}
                    </span>
                  </button>
                </div>
                <ToggleSwitch
                  checked={endpoint.enabled}
                  onChange={(checked) => {
                    onPatch(endpoint.id, { enabled: checked });
                    onFlush(endpoint.id);
                  }}
                  label={`${endpoint.enabled ? "Disable" : "Enable"} ${endpoint.name}`}
                />
                <button
                  type="button"
                  onClick={() => setEditing(endpoint)}
                  aria-label="Edit endpoint"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover hover:text-ink"
                >
                  <PencilIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(endpoint)}
                  aria-label="Delete endpoint"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover hover:text-red-600"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <CustomEndpointEditorModal
          endpoint={editing === "new" ? null : editing}
          customerId={customerId}
          onClose={() => setEditing(null)}
          onCreate={onCreate}
          onPatch={onPatch}
          onFlush={onFlush}
        />
      )}
    </div>
  );
}
