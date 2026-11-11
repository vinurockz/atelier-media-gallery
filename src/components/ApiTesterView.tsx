import { useEffect, useRef, useState } from "react";
import type {
  ApiBodyType,
  ApiHeaderRow,
  ApiHistoryEntry,
  ApiResponseResult,
  HttpMethod,
} from "@/types/apiTester";
import { sendApiRequest } from "@/lib/apiTesterClient";
import { formatTime } from "@/lib/formatDate";
import { ApiHeadersEditor } from "@/components/ApiHeadersEditor";
import { ApiResponseViewer } from "@/components/ApiResponseViewer";
import { PlugIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@/components/icons";

type Props = {
  history: ApiHistoryEntry[];
  onAddHistoryEntry: (entry: Omit<ApiHistoryEntry, "id" | "createdAt">) => void;
  onRemoveHistoryEntry: (id: string) => void;
  onClearHistory: () => void;
};

const METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

const methodColor = (method: HttpMethod) =>
  method === "GET"
    ? "text-emerald-600"
    : method === "POST"
      ? "text-amber-600"
      : method === "DELETE"
        ? "text-red-600"
        : "text-accent";

/** A single-request API testing workbench: pick a method, a URL, headers and an
 * optional body, send it, and inspect the response (pretty JSON, image/video/audio
 * preview, or a download for anything else binary). Past requests are kept in a
 * client-side history you can reload into the builder. */
export function ApiTesterView({
  history,
  onAddHistoryEntry,
  onRemoveHistoryEntry,
  onClearHistory,
}: Props) {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<ApiHeaderRow[]>([]);
  const [bodyType, setBodyType] = useState<ApiBodyType>("none");
  const [body, setBody] = useState("");
  const [reqTab, setReqTab] = useState<"headers" | "body">("headers");

  const [response, setResponse] = useState<ApiResponseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const bodyDisabled = method === "GET" || method === "HEAD";

  const handleSend = async () => {
    const trimmed = url.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await sendApiRequest({
        method,
        url: trimmed,
        headers,
        bodyType: bodyDisabled ? "none" : bodyType,
        body,
      });
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = result.objectUrl;
      setResponse(result);
      onAddHistoryEntry({ method, url: trimmed, headers, bodyType, body });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const loadEntry = (entry: ApiHistoryEntry) => {
    setMethod(entry.method);
    setUrl(entry.url);
    setHeaders(entry.headers);
    setBodyType(entry.bodyType);
    setBody(entry.body);
    setResponse(null);
    setError(null);
  };

  const newRequest = () => {
    setMethod("GET");
    setUrl("");
    setHeaders([]);
    setBodyType("none");
    setBody("");
    setResponse(null);
    setError(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <PlugIcon className="size-4 text-stone" />
          <h1 className="text-base font-medium text-ink">API Tester</h1>
        </div>
        <button
          type="button"
          onClick={newRequest}
          className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
        >
          <PlusIcon className="size-3.5" />
          New request
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-linen bg-surface p-3 sm:flex">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-stone">History</span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="text-xs text-stone hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="px-1 text-xs text-stone">
              Requests you send will show up here.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-linen-hover"
                >
                  <button
                    type="button"
                    onClick={() => loadEntry(entry)}
                    className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md px-1.5 py-1 text-left"
                  >
                    <span className="flex items-center gap-1.5 text-xs">
                      <span
                        className={`w-14 shrink-0 font-semibold ${methodColor(entry.method)}`}
                      >
                        {entry.method}
                      </span>
                      <span className="text-[10px] text-stone">
                        {formatTime(entry.createdAt)}
                      </span>
                    </span>
                    <span className="w-full truncate text-xs text-ink/80">
                      {entry.url}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveHistoryEntry(entry.id)}
                    aria-label="Remove from history"
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-stone opacity-0 hover:bg-linen-hover hover:text-ink group-hover:opacity-100"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
          <div className="flex flex-wrap items-center gap-2 border-b border-linen bg-white px-4 py-3 sm:px-6">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              className={`shrink-0 rounded-md border border-linen bg-surface px-2 py-2 text-sm font-semibold outline-none focus:border-accent ${methodColor(method)}`}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSend();
              }}
              placeholder="https://api.example.com/resource"
              className="min-w-0 flex-1 rounded-md border border-linen bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!url.trim() || loading}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && <SpinnerIcon className="size-3.5 animate-spin" />}
              Send
            </button>
          </div>

          <div className="border-b border-linen bg-white px-4 py-3 sm:px-6">
            <div className="mb-2 flex items-center gap-1">
              {(["headers", "body"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setReqTab(t)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
                    reqTab === t
                      ? "bg-accent-soft text-accent"
                      : "text-stone hover:bg-linen-hover hover:text-ink"
                  }`}
                >
                  {t}
                  {t === "headers" &&
                    headers.filter((h) => h.enabled).length > 0 &&
                    ` (${headers.filter((h) => h.enabled).length})`}
                </button>
              ))}
            </div>
            <div className="max-h-48 overflow-y-auto">
              {reqTab === "headers" ? (
                <ApiHeadersEditor rows={headers} onChange={setHeaders} />
              ) : bodyDisabled ? (
                <p className="text-xs text-stone">
                  {method} requests don't send a body.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    {(["none", "json", "text"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBodyType(t)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
                          bodyType === t
                            ? "bg-accent-soft text-accent"
                            : "text-stone hover:bg-linen-hover hover:text-ink"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {bodyType !== "none" && (
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={
                        bodyType === "json" ? '{\n  "key": "value"\n}' : ""
                      }
                      rows={5}
                      className="w-full resize-none rounded-md border border-linen bg-surface p-2.5 font-mono text-xs text-ink outline-none focus:border-accent"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <ApiResponseViewer
              response={response}
              loading={loading}
              error={error}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
