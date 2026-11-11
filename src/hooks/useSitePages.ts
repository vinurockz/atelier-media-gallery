import { useCallback, useEffect, useState } from "react";
import type { SitePage } from "@/types/website";
import {
  createSitePage,
  deleteSitePage,
  fetchSitePages,
  reorderSitePage,
  updateSitePage,
  type SitePagePatch,
} from "@/lib/api/sites";

/** A single open site's pages. Block/section edits are committed as one `PUT` per
 * change (on drag release, not per pointermove frame) — same "local state during the
 * gesture, one commit when it ends" split the Books/Editor modules use. */
export function useSitePages(
  siteId: string | null,
  onPageCountChange: (delta: number) => void,
) {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPages([]);
    setLoaded(false);
    if (!siteId) return;
    fetchSitePages(siteId)
      .then((p) => {
        setPages(p);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [siteId]);

  const addPage = useCallback(
    async (fields?: { title?: string; slug?: string }) => {
      if (!siteId) return null;
      try {
        const page = await createSitePage(siteId, fields);
        setPages((prev) => [...prev, page]);
        onPageCountChange(1);
        return page.id;
      } catch {
        return null;
      }
    },
    [siteId, onPageCountChange],
  );

  const updatePage = useCallback(
    async (pageId: string, patch: SitePagePatch) => {
      if (!siteId) return;
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
      );
      await updateSitePage(siteId, pageId, patch).catch(() => {});
    },
    [siteId],
  );

  const removePage = useCallback(
    async (pageId: string) => {
      if (!siteId) return;
      await deleteSitePage(siteId, pageId).catch(() => {});
      // The server renumbers remaining pages' `index` on delete — refetch instead of
      // reimplementing that reindex logic client-side.
      const fresh = await fetchSitePages(siteId).catch(() => null);
      if (fresh) setPages(fresh);
      onPageCountChange(-1);
    },
    [siteId, onPageCountChange],
  );

  const reorderPage = useCallback(
    async (pageId: string, index: number) => {
      if (!siteId) return;
      // Optimistic local reorder so the rail feels immediate; the server's response
      // (the full resorted sibling list) reconciles it right after.
      setPages((prev) => {
        const sorted = [...prev].sort((a, b) => a.index - b.index);
        const from = sorted.findIndex((p) => p.id === pageId);
        if (from === -1) return prev;
        const [moved] = sorted.splice(from, 1);
        sorted.splice(Math.max(0, Math.min(sorted.length, index)), 0, moved);
        return sorted.map((p, i) => ({ ...p, index: i }));
      });
      const fresh = await reorderSitePage(siteId, pageId, index).catch(
        () => null,
      );
      if (fresh) setPages(fresh);
    },
    [siteId],
  );

  return { pages, loaded, addPage, updatePage, removePage, reorderPage };
}
