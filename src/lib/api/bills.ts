import type { Bill } from "@/types/bill";
import { request } from "@/lib/api/request";

export function fetchBills(): Promise<Bill[]> {
  return request<Bill[]>("/bills");
}

export function createBill(docType: Bill["docType"]): Promise<Bill> {
  return request<Bill>("/bills", {
    method: "POST",
    body: JSON.stringify({ docType }),
  });
}

export type BillPatch = Partial<Omit<Bill, "id" | "createdAt" | "updatedAt">>;

export function updateBill(id: string, patch: BillPatch): Promise<Bill> {
  return request<Bill>(`/bills/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteBill(id: string): Promise<void> {
  return request<void>(`/bills/${id}`, { method: "DELETE" });
}
