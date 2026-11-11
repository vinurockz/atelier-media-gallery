import { useCallback, useEffect, useState } from "react";
import type { ReportSummary } from "@/types/report";
import { fetchReportSummary } from "@/lib/api/reports";

/**
 * Reports module data — unlike Notes/Tasks/etc. this is a read-only calculation the server
 * redoes from `db` on every request, not durable state of its own, so there's nothing to
 * debounce-save and no reason to poll on a timer while the module isn't even open; the
 * view calls `refresh` itself (on mount, and on demand) instead.
 */
export function useReports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchReportSummary());
    } catch {
      setError("Couldn't load the report — is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, loading, error, refresh };
}
