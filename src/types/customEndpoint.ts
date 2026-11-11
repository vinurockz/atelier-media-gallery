export type CustomEndpointMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type CustomEndpointContentType =
  "application/json" | "text/plain" | "text/html";

/** A custom API you define — method, path, and a fixed response. Served publicly (no login)
 * at /api/custom/<customerId>/<path> — see server/index.mjs's app.all handler. */
export interface CustomEndpoint {
  id: string;
  name: string;
  method: CustomEndpointMethod;
  /** No leading/trailing slash — the segment(s) after /api/custom/<customerId>/. */
  path: string;
  enabled: boolean;
  statusCode: number;
  contentType: CustomEndpointContentType;
  body: string;
  createdAt: number;
  updatedAt: number;
}
