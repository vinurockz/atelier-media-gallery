import type { PdfHighlight } from "@/types/pdf";
import { request } from "@/lib/api/request";

export function fetchPdfHighlights(
  mediaItemId: string,
): Promise<PdfHighlight[]> {
  return request<PdfHighlight[]>(
    `/pdf-highlights?mediaItemId=${encodeURIComponent(mediaItemId)}`,
  );
}

export type NewPdfHighlight = Omit<PdfHighlight, "id" | "createdAt">;

export function createPdfHighlight(
  highlight: NewPdfHighlight,
): Promise<PdfHighlight> {
  return request<PdfHighlight>("/pdf-highlights", {
    method: "POST",
    body: JSON.stringify(highlight),
  });
}

export function deletePdfHighlight(id: string): Promise<void> {
  return request<void>(`/pdf-highlights/${id}`, { method: "DELETE" });
}
