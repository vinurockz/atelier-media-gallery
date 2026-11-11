import { useCallback, useEffect, useState } from "react";
import type { PdfHighlight } from "@/types/pdf";
import {
  createPdfHighlight,
  deletePdfHighlight,
  fetchPdfHighlights,
  type NewPdfHighlight,
} from "@/lib/api/pdfHighlights";

/** Highlights for one open PDF — fetched on mount, created/deleted immediately
 * (a highlight is a discrete action, not continuous typing, so there's no
 * debounce to flush here, unlike Notes/Tasks text edits). */
export function usePdfHighlights(mediaItemId: string) {
  const [highlights, setHighlights] = useState<PdfHighlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPdfHighlights(mediaItemId)
      .then((records) => {
        if (!cancelled) setHighlights(records);
      })
      .catch(() => {
        // No backend reachable — the viewer still works, just without saved highlights.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaItemId]);

  const addHighlight = useCallback(async (highlight: NewPdfHighlight) => {
    try {
      const saved = await createPdfHighlight(highlight);
      setHighlights((prev) => [...prev, saved]);
    } catch {
      // Backend unreachable — the highlight just won't persist this session.
    }
  }, []);

  const removeHighlight = useCallback(async (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    await deletePdfHighlight(id).catch(() => {});
  }, []);

  return { highlights, loading, addHighlight, removeHighlight };
}
