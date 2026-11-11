import type { ReportSummary } from "@/types/report";
import { request } from "@/lib/api/request";

export function fetchReportSummary(): Promise<ReportSummary> {
  return request<ReportSummary>("/reports/summary");
}
