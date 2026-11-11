import type { AuthUser } from "@/types/auth";
import type { Customer } from "@/types/customer";
import { request } from "@/lib/api/request";

export function fetchCustomers(): Promise<Customer[]> {
  return request<Customer[]>("/customers");
}

export function createCustomer(
  name: string,
  description: string,
): Promise<Customer> {
  return request<Customer>("/customers", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export type CustomerPatch = Partial<Pick<Customer, "name" | "description">>;

export function updateCustomer(
  id: string,
  patch: CustomerPatch,
): Promise<Customer> {
  return request<Customer>(`/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteCustomer(id: string): Promise<void> {
  return request<void>(`/customers/${id}`, { method: "DELETE" });
}

export async function uploadCustomerPhoto(
  id: string,
  file: File,
): Promise<Customer> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/customers/${id}/photo`, {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }
  return res.json() as Promise<Customer>;
}

/** The single place that builds a customer's photo URL from its id. */
export function customerPhotoUrl(id: string): string {
  return `/api/customers/${id}/photo`;
}

/** Enters a customer (pass an id) or leaves back to the picker (pass null). */
export function selectCustomer(id: string | null): Promise<AuthUser> {
  return request<AuthUser>("/session/customer", {
    method: "POST",
    body: JSON.stringify({ customerId: id }),
  });
}
