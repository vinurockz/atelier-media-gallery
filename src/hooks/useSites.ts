import { useCallback, useEffect, useState } from "react";
import type { Site } from "@/types/website";
import {
  createSite,
  deleteSite,
  fetchSites,
  updateSite,
  type SitePatch,
} from "@/lib/api/sites";

/** Site list (not pages — see useSitePages for a single open site's pages), backed by
 * the Node API in `server/` the same way as Books/Bills/Notes. */
export function useSites() {
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    fetchSites()
      .then(setSites)
      .catch(() => {
        // No backend reachable yet — sites just stays empty until it is.
      });
  }, []);

  const addSite = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const site = await createSite(trimmed);
    setSites((prev) => [site, ...prev]);
    return site.id;
  }, []);

  const editSite = useCallback(async (id: string, patch: SitePatch) => {
    const updated = await updateSite(id, patch);
    setSites((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }, []);

  const removeSite = useCallback(async (id: string) => {
    await deleteSite(id);
    setSites((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Pulled in from useSitePages when a page is added/removed, so a site tile's page
  // count stays right without a full refetch.
  const bumpPageCount = useCallback((id: string, delta: number) => {
    setSites((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, pageCount: s.pageCount + delta } : s,
      ),
    );
  }, []);

  return { sites, addSite, editSite, removeSite, bumpPageCount };
}
