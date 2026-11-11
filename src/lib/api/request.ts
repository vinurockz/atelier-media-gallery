/** Shared JSON fetch wrapper for every src/lib/api/* client — talks to the Express backend in server/. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    // Explicit, rather than relying on the fetch spec's same-origin default — every route
    // but auth/register and auth/login needs the session cookie to identify both the
    // signed-in user and which customer's data to read/write.
    credentials: "same-origin",
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
