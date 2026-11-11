import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomEndpoint } from "@/types/customEndpoint";
import {
  createCustomEndpoint,
  deleteCustomEndpoint,
  fetchCustomEndpoints,
  updateCustomEndpoint,
  type CustomEndpointPatch,
  type NewCustomEndpoint,
} from "@/lib/api/customEndpoints";

const SAVE_DEBOUNCE_MS = 600;

/** Custom API endpoints, backed by the Node API in `server/` — same durable-JSON-file,
 * debounced-save model as Notes/Tasks. Create/delete go to the server immediately; editing
 * an endpoint's body/path/etc. updates local state right away and saves on a short
 * per-endpoint debounce, since the body is a free-typed JSON/text textarea. */
export function useCustomEndpoints() {
  const [endpoints, setEndpoints] = useState<CustomEndpoint[]>([]);
  const saveTimers = useRef<Map<string, number>>(new Map());
  const pendingPatches = useRef<Map<string, CustomEndpointPatch>>(new Map());

  useEffect(() => {
    fetchCustomEndpoints()
      .then(setEndpoints)
      .catch(() => {
        // No backend reachable yet — endpoints just stays empty until it is.
      });
  }, []);

  const addEndpoint = useCallback(async (values: NewCustomEndpoint) => {
    const endpoint = await createCustomEndpoint(values);
    setEndpoints((prev) => [endpoint, ...prev]);
    return endpoint;
  }, []);

  const flushEndpoint = useCallback((id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      saveTimers.current.delete(id);
    }
    const patch = pendingPatches.current.get(id);
    if (!patch) return;
    pendingPatches.current.delete(id);
    void updateCustomEndpoint(id, patch).catch(() => {});
  }, []);

  const patchEndpoint = useCallback(
    (id: string, patch: CustomEndpointPatch) => {
      setEndpoints((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e,
        ),
      );
      pendingPatches.current.set(id, {
        ...pendingPatches.current.get(id),
        ...patch,
      });
      const timer = saveTimers.current.get(id);
      if (timer !== undefined) window.clearTimeout(timer);
      saveTimers.current.set(
        id,
        window.setTimeout(() => flushEndpoint(id), SAVE_DEBOUNCE_MS),
      );
    },
    [flushEndpoint],
  );

  const removeEndpoint = useCallback(async (id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    saveTimers.current.delete(id);
    pendingPatches.current.delete(id);
    await deleteCustomEndpoint(id);
    setEndpoints((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return {
    endpoints,
    addEndpoint,
    patchEndpoint,
    flushEndpoint,
    removeEndpoint,
  };
}
