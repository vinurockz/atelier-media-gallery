import { useState } from "react";
import type { ApiResponseResult } from "@/types/apiTester";
import { formatBytes } from "@/lib/formatBytes";
import { CheckIcon, CopyIcon, DownloadIcon } from "@/components/icons";

type Props = {
  response: ApiResponseResult | null;
  loading: boolean;
  error: string | null;
};

type ResponseTab = "body" | "headers";
type BodyFormat = "pretty" | "raw";

function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied/unavailable — nothing useful to recover into.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1.5 rounded-md border border-linen bg-surface px-2.5 py-1 text-xs font-medium text-ink/75 hover:bg-linen-hover hover:text-ink"
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-accent" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

function statusColor(status: number) {
  if (status === 0) return "text-stone";
  if (status < 300) return "text-emerald-600";
  if (status < 400) return "text-amber-600";
  return "text-red-600";
}

/** Status line + tabbed Body/Headers viewer for one sent request's response — pretty-prints
 * JSON with a raw fallback, previews image/video/audio bodies, and offers a download for
 * anything else binary. Every text view has its own "copy as text" button. */
export function ApiResponseViewer({ response, loading, error }: Props) {
  const [tab, setTab] = useState<ResponseTab>("body");
  const [format, setFormat] = useState<BodyFormat>("pretty");

  if (loading) {
    return <p className="text-sm text-stone">Sending request…</p>;
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!response) {
    return (
      <p className="text-sm text-stone">
        Send a request to see its response here.
      </p>
    );
  }

  const bodyText =
    response.bodyKind === "json"
      ? format === "pretty"
        ? (response.jsonText ?? "")
        : (response.bodyText ?? "")
      : (response.bodyText ?? "");

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-4 text-sm">
        <span className={`font-semibold ${statusColor(response.status)}`}>
          {response.status || "—"} {response.statusText}
        </span>
        <span className="text-stone">{response.timeMs} ms</span>
        <span className="text-stone">{formatBytes(response.sizeBytes)}</span>
      </div>

      <div className="flex items-center gap-1 border-b border-linen">
        {(["body", "headers"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium capitalize ${
              tab === t
                ? "border-b-2 border-accent text-accent"
                : "text-stone hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "headers" ? (
          response.headers.length === 0 ? (
            <p className="text-sm text-stone">No response headers.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end">
                <CopyButton
                  text={response.headers
                    .map((h) => `${h.key}: ${h.value}`)
                    .join("\n")}
                  label="Copy headers"
                />
              </div>
              <div className="flex flex-col gap-1 font-mono text-xs">
                {response.headers.map((h) => (
                  <div key={h.key} className="flex gap-2">
                    <span className="text-stone">{h.key}:</span>
                    <span className="min-w-0 flex-1 break-all text-ink">
                      {h.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : response.bodyKind === "empty" ? (
          <p className="text-sm text-stone">No response body.</p>
        ) : response.bodyKind === "json" || response.bodyKind === "text" ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              {response.bodyKind === "json" ? (
                <div className="flex items-center gap-1">
                  {(["pretty", "raw"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`rounded-md px-2 py-1 text-xs font-medium capitalize ${
                        format === f
                          ? "bg-accent-soft text-accent"
                          : "text-stone hover:bg-linen-hover hover:text-ink"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <CopyButton text={bodyText} label="Copy as text" />
            </div>
            <pre className="overflow-x-auto rounded-md border border-linen bg-surface p-3 font-mono text-xs text-ink">
              {bodyText}
            </pre>
          </div>
        ) : response.bodyKind === "image" && response.objectUrl ? (
          <div className="flex flex-col gap-2">
            <img
              src={response.objectUrl}
              alt="Response preview"
              className="max-h-[480px] rounded-md border border-linen object-contain"
            />
            <a
              href={response.objectUrl}
              download={response.fileName}
              className="flex w-fit items-center gap-1.5 rounded-md border border-linen bg-surface px-2.5 py-1 text-xs font-medium text-ink/75 hover:bg-linen-hover hover:text-ink"
            >
              <DownloadIcon className="size-3.5" />
              Download
            </a>
          </div>
        ) : response.bodyKind === "video" && response.objectUrl ? (
          <video
            src={response.objectUrl}
            controls
            className="max-h-[480px] w-full rounded-md border border-linen"
          />
        ) : response.bodyKind === "audio" && response.objectUrl ? (
          <audio src={response.objectUrl} controls className="w-full" />
        ) : response.objectUrl ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone">
              {response.contentType || "Binary response"} ·{" "}
              {formatBytes(response.sizeBytes)}
            </p>
            <a
              href={response.objectUrl}
              download={response.fileName}
              className="flex w-fit items-center gap-1.5 rounded-md border border-linen bg-surface px-2.5 py-1 text-xs font-medium text-ink/75 hover:bg-linen-hover hover:text-ink"
            >
              <DownloadIcon className="size-3.5" />
              Download
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
