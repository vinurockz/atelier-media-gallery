import type { Site, SitePage } from "@/types/website";
import { request } from "@/lib/api/request";

export function fetchSites(): Promise<Site[]> {
  return request<Site[]>("/sites");
}

export function createSite(name: string): Promise<Site> {
  return request<Site>("/sites", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export type SitePatch = Partial<
  Pick<Site, "name" | "faviconMediaId" | "themeColor">
>;

export function updateSite(id: string, patch: SitePatch): Promise<Site> {
  return request<Site>(`/sites/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteSite(id: string): Promise<void> {
  return request<void>(`/sites/${id}`, { method: "DELETE" });
}

export function fetchSitePages(siteId: string): Promise<SitePage[]> {
  return request<SitePage[]>(`/sites/${siteId}/pages`);
}

export function createSitePage(
  siteId: string,
  fields?: { title?: string; slug?: string },
): Promise<SitePage> {
  return request<SitePage>(`/sites/${siteId}/pages`, {
    method: "POST",
    body: JSON.stringify(fields ?? {}),
  });
}

export type SitePagePatch = Partial<
  Pick<
    SitePage,
    | "title"
    | "slug"
    | "header"
    | "hero"
    | "sections"
    | "footer"
    | "seoDescription"
  >
>;

export function updateSitePage(
  siteId: string,
  pageId: string,
  patch: SitePagePatch,
): Promise<SitePage> {
  return request<SitePage>(`/sites/${siteId}/pages/${pageId}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteSitePage(siteId: string, pageId: string): Promise<void> {
  return request<void>(`/sites/${siteId}/pages/${pageId}`, {
    method: "DELETE",
  });
}

export function reorderSitePage(
  siteId: string,
  pageId: string,
  index: number,
): Promise<SitePage[]> {
  return request<SitePage[]>(`/sites/${siteId}/pages/${pageId}/reorder`, {
    method: "PUT",
    body: JSON.stringify({ index }),
  });
}
