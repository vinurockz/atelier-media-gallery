import { useMemo, useState } from "react";
import type {
  CustomEndpoint,
  CustomEndpointContentType,
  CustomEndpointMethod,
} from "@/types/customEndpoint";
import type {
  CustomEndpointPatch,
  NewCustomEndpoint,
} from "@/lib/api/customEndpoints";
import {
  customEndpointUrl,
  updateCustomEndpoint,
} from "@/lib/api/customEndpoints";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  PlayIcon,
  SpinnerIcon,
} from "@/components/icons";

type Props = {
  endpoint: CustomEndpoint | null;
  customerId: string;
  onClose: () => void;
  onCreate: (values: NewCustomEndpoint) => Promise<CustomEndpoint>;
  onPatch: (id: string, patch: CustomEndpointPatch) => void;
  onFlush: (id: string) => void;
};

const METHODS: CustomEndpointMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];
const CONTENT_TYPES: CustomEndpointContentType[] = [
  "application/json",
  "text/plain",
  "text/html",
];

const inputClass =
  "w-full rounded-md border border-linen px-3 py-2 text-sm text-ink outline-none focus:border-accent";

/** Create or edit one custom API: method/path/status/content-type/a fixed response body,
 * plus the real public URL (copyable) and a "Try it" button that calls it for real. */
export function CustomEndpointEditorModal({
  endpoint,
  customerId,
  onClose,
  onCreate,
  onPatch,
  onFlush,
}: Props) {
  const [name, setName] = useState(endpoint?.name ?? "");
  const [method, setMethod] = useState<CustomEndpointMethod>(
    endpoint?.method ?? "GET",
  );
  const [path, setPath] = useState(endpoint?.path ?? "");
  const [statusCode, setStatusCode] = useState(endpoint?.statusCode ?? 200);
  const [contentType, setContentType] = useState<CustomEndpointContentType>(
    endpoint?.contentType ?? "application/json",
  );
  const [body, setBody] = useState(endpoint?.body ?? "{\n  \n}");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trying, setTrying] = useState(false);
  const [tryResult, setTryResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const trimmedPath = path.trim().replace(/^\/+|\/+$/g, "");
  const url = customEndpointUrl(customerId, trimmedPath || "…");

  const jsonError = useMemo(() => {
    if (contentType !== "application/json") return null;
    try {
      JSON.parse(body);
      return null;
    } catch {
      return "This isn't valid JSON — it'll still save, but callers may get a parse error.";
    }
  }, [body, contentType]);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    if (!trimmedPath) {
      setError("Path is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const values = {
        name: trimmedName,
        method,
        path: trimmedPath,
        statusCode,
        contentType,
        body,
      };
      if (endpoint) {
        onPatch(endpoint.id, values);
        onFlush(endpoint.id);
      } else {
        await onCreate(values);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const tryIt = async () => {
    if (!trimmedPath || !endpoint) return;
    setTrying(true);
    setTryResult(null);
    try {
      // Save whatever's currently typed (method/path/status/body) for real first — and wait
      // for it — otherwise this would test the last *saved* version, not what's on screen.
      // (The debounced onPatch/onFlush path is fire-and-forget, which this can't wait on.)
      await updateCustomEndpoint(endpoint.id, {
        name,
        method,
        path: trimmedPath,
        statusCode,
        contentType,
        body,
      });
      const res = await fetch(customEndpointUrl(customerId, trimmedPath), {
        method,
      });
      const text = await res.text();
      setTryResult(`${res.status} ${res.statusText}\n\n${text}`);
    } catch (err) {
      setTryResult(
        `Request failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setTrying(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(
        customEndpointUrl(customerId, trimmedPath),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied — nothing more to do.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-linen bg-surface shadow-lifted">
        <div className="flex items-center justify-between border-b border-linen px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            {endpoint ? "Edit custom API" : "New custom API"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-full text-stone transition-colors hover:bg-linen-hover"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Name"
            className={inputClass}
          />

          <div className="flex gap-2">
            <select
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as CustomEndpointMethod)
              }
              className={`${inputClass} w-28 shrink-0 font-semibold`}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="path/segment"
              aria-label="Path"
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-2 rounded-md bg-linen/50 px-2.5 py-1.5">
            <code className="min-w-0 flex-1 truncate text-xs text-stone">
              {url}
            </code>
            <button
              type="button"
              onClick={() => void copyUrl()}
              disabled={!trimmedPath}
              aria-label="Copy URL"
              className="flex size-6 shrink-0 items-center justify-center rounded text-stone transition hover:bg-linen-hover disabled:opacity-40"
            >
              {copied ? (
                <CheckIcon className="size-3.5 text-green-600" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </button>
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 items-center justify-between gap-2 text-xs text-stone">
              Status
              <input
                type="number"
                min={100}
                max={599}
                value={statusCode}
                onChange={(e) => setStatusCode(Number(e.target.value) || 200)}
                className="w-20 rounded-md border border-linen px-2 py-1 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-1 items-center justify-between gap-2 text-xs text-stone">
              Content type
              <select
                value={contentType}
                onChange={(e) =>
                  setContentType(e.target.value as CustomEndpointContentType)
                }
                className="rounded-md border border-linen px-2 py-1 text-sm text-ink outline-none focus:border-accent"
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-stone">Response body</p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              spellCheck={false}
              className="w-full resize-none rounded-md border border-linen px-3 py-2 font-mono text-xs text-ink outline-none focus:border-accent"
            />
            {jsonError && (
              <p className="mt-1 text-xs text-amber-600">{jsonError}</p>
            )}
          </div>

          {endpoint && (
            <label className="flex items-center justify-between text-sm text-ink">
              Enabled
              <ToggleSwitch
                checked={endpoint.enabled}
                onChange={(checked) => {
                  onPatch(endpoint.id, { enabled: checked });
                  onFlush(endpoint.id);
                }}
                label="Enabled"
              />
            </label>
          )}

          <div>
            <button
              type="button"
              onClick={() => void tryIt()}
              disabled={trying || !trimmedPath || !endpoint}
              title={endpoint ? undefined : "Save this endpoint first"}
              className="flex items-center gap-1.5 rounded-md border border-linen px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-linen-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {trying ? (
                <SpinnerIcon className="size-3.5 animate-spin" />
              ) : (
                <PlayIcon className="size-3.5" />
              )}
              {endpoint ? "Try it" : "Try it (save first)"}
            </button>
            {tryResult && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-ink px-3 py-2 text-[11px] text-white/90">
                {tryResult}
              </pre>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-linen px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-stone transition-colors hover:bg-linen-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
