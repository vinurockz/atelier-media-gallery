import type {
  ApiBodyKind,
  ApiBodyType,
  ApiHeaderRow,
  ApiResponseResult,
  HttpMethod,
} from "@/types/apiTester";

const METHODS_WITHOUT_BODY = new Set<HttpMethod>(["GET", "HEAD"]);

interface ProxyResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: { key: string; value: string }[];
  timeMs: number;
  bodyBase64: string;
}

function fileNameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const last = pathname.split("/").filter(Boolean).pop();
    return last || "response";
  } catch {
    return "response";
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Sends one ad-hoc request from the API Tester module, through this app's own
 * `/api/api-tester/send` backend route rather than straight from the browser — a
 * direct cross-origin fetch with a custom header (Authorization) or a JSON/text body
 * triggers a CORS preflight, and most APIs under test don't answer it for our origin,
 * so the browser drops the request before it's even sent. The server hop has no such
 * restriction. Classifies the response by Content-Type so the viewer can render
 * JSON/text/image/video/audio/binary without guessing per-call. */
export async function sendApiRequest(input: {
  method: HttpMethod;
  url: string;
  headers: ApiHeaderRow[];
  bodyType: ApiBodyType;
  body: string;
}): Promise<ApiResponseResult> {
  const headerRows = input.headers
    .filter((h) => h.enabled && h.key.trim().length > 0)
    .map((h) => ({ key: h.key.trim(), value: h.value }));

  const canSendBody =
    input.bodyType !== "none" && !METHODS_WITHOUT_BODY.has(input.method);
  const hasContentType = headerRows.some(
    (h) => h.key.toLowerCase() === "content-type",
  );
  if (canSendBody && input.body.trim() && !hasContentType) {
    headerRows.push({
      key: "Content-Type",
      value: input.bodyType === "json" ? "application/json" : "text/plain",
    });
  }

  const res = await fetch("/api/api-tester/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: input.method,
      url: input.url,
      headers: headerRows,
      body: canSendBody && input.body.trim() ? input.body : undefined,
    }),
  });

  const payload = (await res.json().catch(() => null)) as
    ProxyResponse | { error?: string } | null;
  if (!res.ok || !payload || !("status" in payload)) {
    const message =
      payload && "error" in payload && payload.error
        ? payload.error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  const contentType =
    payload.headers.find((h) => h.key.toLowerCase() === "content-type")
      ?.value ?? "";

  const bytes = base64ToBytes(payload.bodyBase64);
  const sizeBytes = bytes.length;

  let bodyKind: ApiBodyKind = "empty";
  let bodyText: string | null = null;
  let jsonText: string | null = null;
  let objectUrl: string | null = null;

  if (bytes.length === 0) {
    bodyKind = "empty";
  } else if (/application\/json|\+json\b/i.test(contentType)) {
    bodyText = new TextDecoder().decode(bytes);
    try {
      jsonText = JSON.stringify(JSON.parse(bodyText), null, 2);
      bodyKind = "json";
    } catch {
      bodyKind = "text";
    }
  } else if (/^image\//i.test(contentType)) {
    bodyKind = "image";
    objectUrl = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  } else if (/^video\//i.test(contentType)) {
    bodyKind = "video";
    objectUrl = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  } else if (/^audio\//i.test(contentType)) {
    bodyKind = "audio";
    objectUrl = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  } else if (/^text\/|xml/i.test(contentType)) {
    bodyText = new TextDecoder().decode(bytes);
    bodyKind = "text";
  } else {
    bodyKind = "binary";
    objectUrl = URL.createObjectURL(
      new Blob([bytes], { type: contentType || "application/octet-stream" }),
    );
  }

  return {
    status: payload.status,
    statusText: payload.statusText,
    ok: payload.ok,
    headers: payload.headers,
    timeMs: payload.timeMs,
    sizeBytes,
    contentType,
    bodyKind,
    bodyText,
    jsonText,
    objectUrl,
    fileName: fileNameFromUrl(input.url),
  };
}
