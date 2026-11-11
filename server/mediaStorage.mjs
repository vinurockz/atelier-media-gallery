import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dbContext } from "./db.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CUSTOMERS_DIR = join(ROOT, "data", "customers");

/** Each customer's uploads live under their own data directory, isolated from every other customer's. */
export function uploadsDirFor(customerId) {
  const dir = join(CUSTOMERS_DIR, customerId, "uploads");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** The active customer's uploads dir for the request currently in flight — see db.mjs's dbContext. */
export function currentUploadsDir() {
  const store = dbContext.getStore();
  if (!store) throw new Error("No customer context for this request");
  return uploadsDirFor(store.customerId);
}

/** Deletes a stored file by its on-disk name, from the current request's customer; ignores it if already gone. */
export function deleteUploadedFile(filename) {
  try {
    unlinkSync(join(currentUploadsDir(), filename));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}
