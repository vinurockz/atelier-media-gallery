import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, "data");
const CUSTOMERS_DIR = join(DATA_DIR, "customers");
const TOP_DB_FILE = join(DATA_DIR, "top.json");
const CUSTOMER_PHOTOS_DIR = join(DATA_DIR, "customer-photos");

if (!existsSync(CUSTOMER_PHOTOS_DIR)) mkdirSync(CUSTOMER_PHOTOS_DIR, { recursive: true });

// Mirrors src/lib/noteColor.ts's NOTE_COLOR_SWATCHES — notes used to store a preset *key*
// ("red", "default", ...) here instead of a raw hex; this maps any old key-based value
// found on disk to its hex equivalent so existing notes don't render with an invalid
// `background-color: red` (the CSS keyword, not the pastel swatch) after the color field
// became a plain hex string.
const LEGACY_NOTE_COLOR_HEX = {
  default: "#ffffff",
  red: "#f6c9c6",
  orange: "#fde3cc",
  yellow: "#fbf1b7",
  green: "#d7edc9",
  teal: "#c9eded",
  blue: "#cfe4fb",
  purple: "#e5d4f2",
  pink: "#f6d3e4",
};

// One customer's worth of data — every module's collections, identical in shape to the
// single global store this app used to have. Every logged-in user's customer gets its own
// copy of this, in its own file (see loadCustomerDb below), so none of this ever crosses
// between customers.
const EMPTY_DB = {
  contents: [],
  users: [],
  messages: [],
  categories: [],
  notes: [],
  // Text Chat conversations — see src/types/textChat.ts. Each conversation holds its
  // messages array embedded, like Movies' clips, since one conversation's sentence list
  // stays small enough that there's no "fetch one without pulling every other's" problem
  // to solve, and text HTML is sanitized client-side (DOMPurify) before it's ever sent.
  textChats: [],
  bills: [],
  books: [],
  bookPages: [],
  taskSections: [],
  tasks: [],
  pdfHighlights: [],
  movies: [],
  // Metadata only — id, title, category, the on-disk filename, mimeType and
  // size. The actual bytes live in data/customers/<id>/uploads/ (see
  // mediaStorage.mjs), not in this JSON file, same reasoning as every other
  // collection here storing only scalars/ids and never binary blobs.
  media: [],
  // Website Builder — see src/types/website.ts. Sites and their pages are separate
  // collections, same split as Books' books/bookPages, so listing one site's pages
  // never pulls every other site's. A page's header/hero/sections/footer (and the
  // section > column > block tree inside) are embedded directly on the page, like
  // BookPage.elements, since one page's block tree stays small enough not to need
  // its own collection.
  sites: [],
  sitePages: [],
  // Slideshow module — see src/types/movie.ts. A slideshow is stored exactly like a Movie
  // (same shape, same sanitizers) in its own collection, so its list stays separate from
  // Movies' even though they share the same editing/export engine (MovieWorkspace).
  slideshows: [],
  // Custom APIs module — see src/types/customEndpoint.ts. Each one is a fixed method/path/
  // status/content-type/body you define; the actual public serving route
  // (GET/POST/etc /api/custom/<customerId>/<path>) reads this collection directly, bypassing
  // the session/customer-resolving middleware entirely, since it must be callable with no
  // login at all — see server/index.mjs's app.all("/api/custom/:customerId/*", ...).
  customEndpoints: [],
};

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// A brand-new board starts with these three columns; `taskBoardSeeded` stops them from
// coming back after the user deletes them.
function defaultTaskSections() {
  return [
    { title: "New tasks", color: "#1e90ff" },
    { title: "Completed", color: "#22b24c" },
    { title: "Pending", color: "#d11f2f" },
  ].map((s) => ({
    id: `section:${randomUUID()}`,
    ...s,
    createdAt: Date.now(),
  }));
}

function customerDbFile(customerId) {
  return join(CUSTOMERS_DIR, customerId, "db.json");
}

function loadCustomerDb(customerId) {
  const file = customerDbFile(customerId);
  if (!existsSync(file)) {
    return {
      ...structuredClone(EMPTY_DB),
      taskSections: defaultTaskSections(),
      taskBoardSeeded: true,
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return {
      // imageMediaItemId/description were added after some contents may already exist on
      // disk — default them in so every content always has both fields.
      contents: (parsed.contents ?? []).map((c) => ({
        imageMediaItemId: null,
        description: "",
        ...c,
      })),
      users: parsed.users ?? [],
      messages: parsed.messages ?? [],
      // Explicitly-created category/folder names — see useOrganization's customCategories
      // and categoryFolders, which this durably backs. Not the full item-organization
      // state (item moves, colors, hidden items stay local — they're tied to ephemeral
      // client-side media item ids, not meaningful to persist server-side).
      categories: parsed.categories ?? [],
      // Sticky notes — see src/types/notes.ts. Blocks (text/image/link) are stored as
      // the client sends them; text block HTML is sanitized client-side before it ever
      // reaches here, and again before render, so the server treats it as opaque.
      notes: (parsed.notes ?? []).map((n) => ({
        ...n,
        color: LEGACY_NOTE_COLOR_HEX[n.color] ?? n.color,
      })),
      // Text Chat conversations — see src/types/textChat.ts.
      textChats: parsed.textChats ?? [],
      // Bills/quotations — see src/types/bill.ts. PDF/photo export happens entirely
      // client-side (window.print() and a canvas render) — the server can now reach the
      // logo/signature bytes too (see the `media` collection below), but export stays
      // client-side for consistency with Books' identical print-area approach, not
      // because of a storage limitation anymore.
      // fullWidth/align/indent/amountAlign/amountIndent were added to items after some bills
      // may already exist — default them in so every item always has all of them.
      bills: (parsed.bills ?? []).map((b) => ({
        ...b,
        items: (b.items ?? []).map((it) => ({
          fullWidth: false,
          align: "left",
          indent: 0,
          amountAlign: "right",
          amountIndent: 0,
          ...it,
        })),
      })),
      // Books — see src/types/book.ts. A book's pages live in their own collection
      // (bookPages), same split as contents/users/messages, so a page list fetch doesn't
      // have to pull every other book's pages too. Export is client-side (window.print()
      // over pages with CSS page breaks, like Bills' print-area trick) by choice, not
      // because a page's image elements are out of the server's reach anymore.
      books: parsed.books ?? [],
      bookPages: parsed.bookPages ?? [],
      // Task board — see src/types/task.ts. Sections and tasks are separate collections;
      // array order is display order. Tasks first stored a plain `description` and
      // `imageMediaItemIds`; those are folded into `blocks` here so every task has only blocks.
      taskSections:
        parsed.taskSections ??
        (parsed.taskBoardSeeded ? [] : defaultTaskSections()),
      taskBoardSeeded: true,
      tasks: (parsed.tasks ?? []).map(
        ({ description, imageMediaItemIds, ...t }) => ({
          ...t,
          blocks: t.blocks ?? [
            ...(description
              ? [
                  {
                    id: randomUUID(),
                    type: "text",
                    html: `<p>${escapeHtml(description)}</p>`,
                  },
                ]
              : []),
            ...(imageMediaItemIds ?? []).map((mediaItemId) => ({
              id: randomUUID(),
              type: "image",
              mediaItemId,
            })),
          ],
        }),
      ),
      // PDF text highlights — see src/types/pdf.ts. mediaItemId references a client-side
      // MediaItem id the server never otherwise knows about (same "opaque reference" model
      // as Notes'/Tasks' image blocks), so there's no foreign-key cleanup when a PDF is
      // deleted client-side; a highlight for a since-deleted PDF just never matches anything.
      pdfHighlights: parsed.pdfHighlights ?? [],
      // Movies — see src/types/movie.ts. Clips live embedded in the movie document (not a
      // separate collection like Books' pages) since a movie's clip list stays small enough
      // that there's no "fetch one movie's clips without pulling every other movie's" problem
      // to solve; the whole clips array is patched at once, same as Notes' blocks.
      movies: parsed.movies ?? [],
      // Uploaded file metadata — see mediaStorage.mjs. The bytes live on disk
      // under data/customers/<id>/uploads/; this is only id/title/category/filename/
      // mimeType/size.
      media: parsed.media ?? [],
      sites: parsed.sites ?? [],
      sitePages: parsed.sitePages ?? [],
      slideshows: parsed.slideshows ?? [],
      customEndpoints: parsed.customEndpoints ?? [],
    };
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

const customerDbCache = new Map();

/** Loads (and caches in memory) one customer's data store. */
export function getCustomerDb(customerId) {
  if (!customerDbCache.has(customerId)) {
    customerDbCache.set(customerId, loadCustomerDb(customerId));
  }
  return customerDbCache.get(customerId);
}

/** Atomically persists one customer's store to disk — write to a temp file, then rename over the real one. */
export function persistCustomerDb(customerId) {
  const data = customerDbCache.get(customerId);
  if (!data) return;
  const dir = join(CUSTOMERS_DIR, customerId);
  mkdirSync(dir, { recursive: true });
  const file = customerDbFile(customerId);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, file);
}

/** Wipes a customer's entire data store (db.json + its uploaded files) — called when the customer itself is deleted. */
export function deleteCustomerData(customerId) {
  customerDbCache.delete(customerId);
  rmSync(join(CUSTOMERS_DIR, customerId), { recursive: true, force: true });
}

// --- Request-scoped db/persist, backed by AsyncLocalStorage ----------------------------
//
// Every existing route in index.mjs (and every module it was written for — Notes, Bills,
// Books, Tasks, Chat, Movies, Media, Website Builder, Text Chat, PDFs, Reports) was
// written against one global `db` object and a bare `persist()` call, back when there was
// only ever one customer. Rather than rewrite all ~70 of those routes to thread a
// customerId through every call, `db` here is a Proxy that transparently reads/writes
// whichever customer's store is active for the *current request*, and `persist()` saves
// that same customer's file — both resolved through AsyncLocalStorage (see
// server/index.mjs's auth/customer-resolving middleware, which wraps the rest of the
// request in `dbContext.run(...)`), so concurrent requests for different customers never
// cross streams.
export const dbContext = new AsyncLocalStorage();

function currentCustomerDb() {
  const store = dbContext.getStore();
  if (!store) throw new Error("No customer context for this request");
  return store.db;
}

export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      return currentCustomerDb()[prop];
    },
    set(_target, prop, value) {
      currentCustomerDb()[prop] = value;
      return true;
    },
  },
);

export function persist() {
  const store = dbContext.getStore();
  if (!store) throw new Error("No customer context for this request");
  persistCustomerDb(store.customerId);
}

// --- Top-level store: login accounts + customer records (never customer-scoped) --------
const EMPTY_TOP_DB = { authUsers: [], customers: [] };

function loadTopDb() {
  if (!existsSync(TOP_DB_FILE)) return structuredClone(EMPTY_TOP_DB);
  try {
    const parsed = JSON.parse(readFileSync(TOP_DB_FILE, "utf8"));
    return {
      authUsers: parsed.authUsers ?? [],
      customers: parsed.customers ?? [],
    };
  } catch {
    return structuredClone(EMPTY_TOP_DB);
  }
}

/** Login accounts + customer records — held in memory and mutated in place by auth/customer routes. */
export const topDb = loadTopDb();

export function persistTopDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${TOP_DB_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(topDb, null, 2), "utf8");
  renameSync(tmp, TOP_DB_FILE);
}

// --- Customer photo storage (top-level — a customer's own avatar, not part of its own
// Files library) -------------------------------------------------------------------------
export function customerPhotoPath(customerId, ext) {
  return join(CUSTOMER_PHOTOS_DIR, `${customerId}${ext}`);
}

export function writeCustomerPhoto(customerId, ext, buffer) {
  writeFileSync(customerPhotoPath(customerId, ext), buffer);
}

export function deleteCustomerPhoto(customerId, ext) {
  if (!ext) return;
  try {
    unlinkSync(customerPhotoPath(customerId, ext));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}
