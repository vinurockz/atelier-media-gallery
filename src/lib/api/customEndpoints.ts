import type { CustomEndpoint } from "@/types/customEndpoint";
import { request } from "@/lib/api/request";

export function fetchCustomEndpoints(): Promise<CustomEndpoint[]> {
  return request<CustomEndpoint[]>("/custom-endpoints");
}

export type NewCustomEndpoint = Pick<
  CustomEndpoint,
  "name" | "method" | "path" | "statusCode" | "contentType" | "body"
>;

export function createCustomEndpoint(
  values: NewCustomEndpoint,
): Promise<CustomEndpoint> {
  return request<CustomEndpoint>("/custom-endpoints", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export type CustomEndpointPatch = Partial<
  Pick<
    CustomEndpoint,
    | "name"
    | "method"
    | "path"
    | "enabled"
    | "statusCode"
    | "contentType"
    | "body"
  >
>;

export function updateCustomEndpoint(
  id: string,
  patch: CustomEndpointPatch,
): Promise<CustomEndpoint> {
  return request<CustomEndpoint>(`/custom-endpoints/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteCustomEndpoint(id: string): Promise<void> {
  return request<void>(`/custom-endpoints/${id}`, { method: "DELETE" });
}

/** The single place that builds a custom endpoint's real, publicly-callable URL. */
export function customEndpointUrl(customerId: string, path: string): string {
  return `${window.location.origin}/api/custom/${customerId}/${path}`;
}
