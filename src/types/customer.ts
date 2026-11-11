/** A customer your account manages — every other module's data (Files, Chat, Notes, ...)
 * lives inside one of these, completely separate from any other customer's. See
 * server/index.mjs's toPublicCustomer. */
export interface Customer {
  id: string;
  name: string;
  description: string;
  hasPhoto: boolean;
  createdAt: number;
  updatedAt: number;
}
