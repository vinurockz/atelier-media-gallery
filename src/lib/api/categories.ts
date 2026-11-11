import { request } from "@/lib/api/request";

export interface CategoryRecord {
  name: string;
  folders: string[];
}

/** Durable record of categories/folders someone explicitly created — see server/index.mjs. */
export function fetchCategories(): Promise<CategoryRecord[]> {
  return request<CategoryRecord[]>("/categories");
}

export function createCategoryRemote(name: string): Promise<CategoryRecord> {
  return request<CategoryRecord>("/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function createFolderRemote(
  category: string,
  name: string,
): Promise<{ name: string }> {
  return request<{ name: string }>(
    `/categories/${encodeURIComponent(category)}/folders`,
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
  );
}
