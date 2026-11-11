import express from "express";
import multer from "multer";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  customerPhotoPath,
  db,
  dbContext,
  deleteCustomerData,
  deleteCustomerPhoto,
  getCustomerDb,
  persist,
  persistTopDb,
  topDb,
  writeCustomerPhoto,
} from "./db.mjs";
import { buildChatPdf } from "./pdf.mjs";
import { currentUploadsDir, deleteUploadedFile } from "./mediaStorage.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(ROOT, "..", "dist");
const PORT = process.env.PORT ?? 4000;

// Mirrors src/lib/color.ts's COLOR_SWATCHES, in COLOR_ORDER — kept as a flat
// array here since the server has no access to that browser-oriented module.
const COLOR_SWATCHES = [
  "#dc2626",
  "#ea580c",
  "#eab308",
  "#16a34a",
  "#0d9488",
  "#2563eb",
  "#9333ea",
  "#db2777",
  "#92400e",
  "#f1f5f9",
  "#64748b",
  "#171717",
];

const app = express();
// Default 100kb is too tight for the API Tester module, which can echo back
// whatever body/response size the request under test actually has.
app.use(express.json({ limit: "10mb" }));

// --- Auth: cookie-based sessions + scrypt password hashing (both from node:crypto, no
// new dependency), optional Google sign-in. Every other route below this point runs
// inside a customer's own data store (see db.mjs's AsyncLocalStorage-backed `db` proxy) —
// this block resolves which one before any of them run. -------------------------------
const SESSION_COOKIE = "sid";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** token -> { userId, activeCustomerId, expiresAt } — in-memory only, so a server restart
 * signs everyone out; acceptable for a local tool, and avoids a session-store dependency. */
const sessions = new Map();

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = (stored ?? "").split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidate = scryptSync(password, salt, 64);
  return (
    hashBuffer.length === candidate.length &&
    timingSafeEqual(hashBuffer, candidate)
  );
}

function createSession(userId) {
  const token = randomUUID();
  sessions.set(token, {
    userId,
    activeCustomerId: null,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  maxAge: SESSION_TTL_MS,
};

function toPublicUser(user, session) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    googleLinked: Boolean(user.googleLinked),
    activeCustomerId: session?.activeCustomerId ?? null,
  };
}

function toPublicCustomer(customer) {
  return {
    id: customer.id,
    name: customer.name,
    description: customer.description,
    hasPhoto: Boolean(customer.photoExt),
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

// Reachable with no session at all.
const PUBLIC_AUTH_PATHS = new Set([
  "/auth/register",
  "/auth/login",
  "/auth/google/start",
  "/auth/google/callback",
  "/auth/google/status",
]);
// Need a signed-in user but not an active customer — choosing/managing customers (and
// checking who's signed in) is what happens on these.
const ACCOUNT_ONLY_PREFIXES = [
  "/customers",
  "/auth/me",
  "/auth/logout",
  "/session/customer",
];

function resolveAuthAndCustomer(req, res, next) {
  if (PUBLIC_AUTH_PATHS.has(req.path)) return next();
  // Custom API endpoints are deliberately public — no session at all, callable by any
  // external tool/script — see the Custom APIs module's serving route below.
  if (req.path.startsWith("/custom/")) return next();

  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: "Not signed in" });
  }
  const user = topDb.authUsers.find((u) => u.id === session.userId);
  if (!user) return res.status(401).json({ error: "Not signed in" });
  req.user = user;
  req.session = session;

  if (
    ACCOUNT_ONLY_PREFIXES.some(
      (p) => req.path === p || req.path.startsWith(`${p}/`),
    )
  ) {
    return next();
  }

  if (!session.activeCustomerId) {
    return res.status(409).json({ error: "No customer selected" });
  }
  const customer = topDb.customers.find(
    (c) => c.id === session.activeCustomerId && c.ownerUserId === user.id,
  );
  if (!customer) {
    session.activeCustomerId = null;
    return res.status(409).json({ error: "No customer selected" });
  }
  const customerDb = getCustomerDb(customer.id);
  dbContext.run({ db: customerDb, customerId: customer.id }, next);
}

app.use("/api", resolveAuthAndCustomer);

// --- Auth routes -------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/auth/register", (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }
  if (topDb.authUsers.some((u) => u.email === email)) {
    return res
      .status(409)
      .json({ error: "An account with this email already exists" });
  }
  const user = {
    id: `user:${randomUUID()}`,
    email,
    name: name || email.split("@")[0],
    passwordHash: hashPassword(password),
    googleLinked: false,
    createdAt: Date.now(),
  };
  topDb.authUsers.push(user);
  persistTopDb();
  const token = createSession(user.id);
  res.cookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
  res.status(201).json(toPublicUser(user, sessions.get(token)));
});

app.post("/api/auth/login", (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const user = topDb.authUsers.find((u) => u.email === email);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = createSession(user.id);
  res.cookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
  res.json(toPublicUser(user, sessions.get(token)));
});

app.post("/api/auth/logout", (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});

app.get("/api/auth/me", (req, res) => {
  res.json(toPublicUser(req.user, req.session));
});

// Switches which customer the signed-in session is currently inside — every other route
// reads this (via resolveAuthAndCustomer above) instead of trusting a client-supplied id.
app.post("/api/session/customer", (req, res) => {
  const customerId =
    typeof req.body?.customerId === "string" ? req.body.customerId : null;
  if (customerId === null) {
    req.session.activeCustomerId = null;
    return res.json(toPublicUser(req.user, req.session));
  }
  const customer = topDb.customers.find(
    (c) => c.id === customerId && c.ownerUserId === req.user.id,
  );
  if (!customer) return res.status(404).json({ error: "customer not found" });
  req.session.activeCustomerId = customerId;
  res.json(toPublicUser(req.user, req.session));
});

// --- Google sign-in — inert (501) until GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are set via
// env vars (GOOGLE_REDIRECT_URI too, if this isn't running on localhost:PORT). The full
// authorization-code flow is otherwise already wired up, so turning it on later is just
// supplying credentials from Google Cloud Console, not writing new code. ----------------
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ??
  `http://localhost:${PORT}/api/auth/google/callback`;

// Lets the login page disable/explain the Google button instead of sending someone into a
// redirect that's just going to 501 at the other end.
app.get("/api/auth/google/status", (req, res) => {
  res.json({ configured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) });
});

app.get("/api/auth/google/start", (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res
      .status(501)
      .json({ error: "Google sign-in isn't configured on this server yet." });
  }
  const state = randomUUID();
  res.cookie("g_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 5 * 60 * 1000,
  });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get("/api/auth/google/callback", async (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res
      .status(501)
      .send("Google sign-in isn't configured on this server yet.");
  }
  const cookies = parseCookies(req);
  if (!req.query.state || req.query.state !== cookies.g_state) {
    return res
      .status(400)
      .send("Invalid or expired sign-in attempt — please try again.");
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code: String(req.query.code ?? ""),
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error("token exchange failed");
    const tokens = await tokenRes.json();

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (!profileRes.ok) throw new Error("profile fetch failed");
    const profile = await profileRes.json();
    const email = String(profile.email ?? "").toLowerCase();
    if (!email) throw new Error("no email in Google profile");

    let user = topDb.authUsers.find((u) => u.email === email);
    if (!user) {
      user = {
        id: `user:${randomUUID()}`,
        email,
        name: profile.name || email.split("@")[0],
        passwordHash: null,
        googleLinked: true,
        createdAt: Date.now(),
      };
      topDb.authUsers.push(user);
    } else if (!user.googleLinked) {
      user.googleLinked = true;
    }
    persistTopDb();

    const token = createSession(user.id);
    res.cookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
    res.clearCookie("g_state");
    res.redirect("/");
  } catch (err) {
    console.error("Google sign-in failed", err);
    res.status(502).send("Google sign-in failed — please try again.");
  }
});

// --- Customers — see src/types/customer.ts. Owned by the signed-in user; each one's own
// data (Files, Chat, Notes, every other module) lives in its own store (db.mjs's
// getCustomerDb), entered via POST /api/session/customer above. ------------------------
function requireCustomer(req, res, next) {
  const customer = topDb.customers.find(
    (c) => c.id === req.params.id && c.ownerUserId === req.user.id,
  );
  if (!customer) return res.status(404).json({ error: "customer not found" });
  req.customer = customer;
  next();
}

app.get("/api/customers", (req, res) => {
  res.json(
    topDb.customers
      .filter((c) => c.ownerUserId === req.user.id)
      .map(toPublicCustomer),
  );
});

app.post("/api/customers", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "name is required" });
  const description =
    typeof req.body?.description === "string"
      ? req.body.description.trim()
      : "";
  const now = Date.now();
  const customer = {
    // No "customer:" prefix (unlike note:/media:/task: ids elsewhere) — this id is used
    // as a literal filesystem directory/filename (see db.mjs's getCustomerDb and
    // customerPhotoPath), and Windows rejects ":" in path segments.
    id: randomUUID(),
    ownerUserId: req.user.id,
    name,
    description,
    photoExt: null,
    createdAt: now,
    updatedAt: now,
  };
  topDb.customers.push(customer);
  persistTopDb();
  res.status(201).json(toPublicCustomer(customer));
});

app.put("/api/customers/:id", requireCustomer, (req, res) => {
  const body = req.body ?? {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return res.status(400).json({ error: "name is required" });
    req.customer.name = name;
  }
  if (typeof body.description === "string") {
    req.customer.description = body.description.trim();
  }
  req.customer.updatedAt = Date.now();
  persistTopDb();
  res.json(toPublicCustomer(req.customer));
});

app.delete("/api/customers/:id", requireCustomer, (req, res) => {
  topDb.customers = topDb.customers.filter((c) => c.id !== req.customer.id);
  deleteCustomerPhoto(req.customer.id, req.customer.photoExt);
  deleteCustomerData(req.customer.id);
  for (const session of sessions.values()) {
    if (session.activeCustomerId === req.customer.id) {
      session.activeCustomerId = null;
    }
  }
  persistTopDb();
  res.status(204).end();
});

const customerPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.post(
  "/api/customers/:id/photo",
  requireCustomer,
  customerPhotoUpload.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const ext = extname(req.file.originalname) || ".jpg";
    deleteCustomerPhoto(req.customer.id, req.customer.photoExt);
    writeCustomerPhoto(req.customer.id, ext, req.file.buffer);
    req.customer.photoExt = ext;
    req.customer.updatedAt = Date.now();
    persistTopDb();
    res.json(toPublicCustomer(req.customer));
  },
);

app.get("/api/customers/:id/photo", requireCustomer, (req, res) => {
  if (!req.customer.photoExt) {
    return res.status(404).json({ error: "no photo" });
  }
  res.sendFile(
    customerPhotoPath(req.customer.id, req.customer.photoExt),
    (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "file not found on disk" });
      }
    },
  );
});

function slugify(name) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "chat"
  );
}

function requireContent(req, res, next) {
  const content = db.contents.find((c) => c.id === req.params.id);
  if (!content) return res.status(404).json({ error: "content not found" });
  req.content = content;
  next();
}

function requireMessage(req, res, next) {
  const message = db.messages.find(
    (m) => m.id === req.params.messageId && m.contentId === req.params.id,
  );
  if (!message) return res.status(404).json({ error: "message not found" });
  req.message = message;
  next();
}

app.get("/api/contents", (req, res) => {
  res.json(db.contents);
});

app.post("/api/contents", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "name is required" });
  const content = {
    id: `content:${randomUUID()}`,
    name,
    imageMediaItemId: null,
    description: "",
    createdAt: Date.now(),
  };
  db.contents.push(content);
  persist();
  res.status(201).json(content);
});

// Partial update — name/image/description are all optional on a content, so the client
// only sends the fields it changed.
app.put("/api/contents/:id", requireContent, (req, res) => {
  const body = req.body ?? {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return res.status(400).json({ error: "name is required" });
    req.content.name = name;
  }
  if (typeof body.description === "string")
    req.content.description = body.description.trim();
  if (
    body.imageMediaItemId === null ||
    typeof body.imageMediaItemId === "string"
  ) {
    req.content.imageMediaItemId = body.imageMediaItemId;
  }
  persist();
  res.json(req.content);
});

// Deleting a content cascades to its users and messages — they're meaningless without it.
app.delete("/api/contents/:id", requireContent, (req, res) => {
  db.contents = db.contents.filter((c) => c.id !== req.params.id);
  db.users = db.users.filter((u) => u.contentId !== req.params.id);
  db.messages = db.messages.filter((m) => m.contentId !== req.params.id);
  persist();
  res.status(204).end();
});

app.get("/api/contents/:id/users", requireContent, (req, res) => {
  res.json(db.users.filter((u) => u.contentId === req.params.id));
});

app.post("/api/contents/:id/users", requireContent, (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "name is required" });
  const count = db.users.filter((u) => u.contentId === req.params.id).length;
  const user = {
    id: `user:${randomUUID()}`,
    contentId: req.params.id,
    name,
    color: COLOR_SWATCHES[count % COLOR_SWATCHES.length],
  };
  db.users.push(user);
  persist();
  res.status(201).json(user);
});

app.get("/api/contents/:id/messages", requireContent, (req, res) => {
  res.json(db.messages.filter((m) => m.contentId === req.params.id));
});

app.post("/api/contents/:id/messages", requireContent, (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const attachmentIds = Array.isArray(req.body?.attachmentIds)
    ? req.body.attachmentIds.filter((x) => typeof x === "string")
    : [];
  const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
  if (!text && attachmentIds.length === 0) {
    return res.status(400).json({ error: "text or attachmentIds is required" });
  }
  const userOk = db.users.some(
    (u) => u.id === userId && u.contentId === req.params.id,
  );
  if (!userOk)
    return res.status(400).json({ error: "unknown user for this content" });

  const message = {
    id: `msg:${randomUUID()}`,
    contentId: req.params.id,
    userId,
    text,
    attachmentIds,
    createdAt: Date.now(),
  };
  db.messages.push(message);
  persist();
  res.status(201).json(message);
});

app.put(
  "/api/contents/:id/messages/:messageId",
  requireContent,
  requireMessage,
  (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const attachmentIds = Array.isArray(req.body?.attachmentIds)
      ? req.body.attachmentIds.filter((x) => typeof x === "string")
      : [];
    if (!text && attachmentIds.length === 0) {
      return res
        .status(400)
        .json({ error: "text or attachmentIds is required" });
    }
    req.message.text = text;
    req.message.attachmentIds = attachmentIds;
    req.message.editedAt = Date.now();
    persist();
    res.json(req.message);
  },
);

app.delete(
  "/api/contents/:id/messages/:messageId",
  requireContent,
  requireMessage,
  (req, res) => {
    db.messages = db.messages.filter((m) => m.id !== req.params.messageId);
    persist();
    res.status(204).end();
  },
);

app.get("/api/contents/:id/export.pdf", requireContent, (req, res) => {
  const users = db.users.filter((u) => u.contentId === req.params.id);
  const messages = db.messages.filter((m) => m.contentId === req.params.id);
  const asUserId =
    typeof req.query.asUserId === "string" ? req.query.asUserId : null;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${slugify(req.content.name)}-chat.pdf"`,
  );
  buildChatPdf({ content: req.content, users, messages, asUserId }).pipe(res);
});

// Durable backing for useOrganization's "explicitly created" categories/folders — the
// category "key" the client uses everywhere else is the name itself (stable from the
// moment it's created, even after a display rename), so no separate id is needed here.
app.get("/api/categories", (req, res) => {
  res.json(db.categories);
});

app.post("/api/categories", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "name is required" });
  const existing = db.categories.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return res.status(200).json(existing);
  const category = { name, folders: [] };
  db.categories.push(category);
  persist();
  res.status(201).json(category);
});

// Upserts the category: a folder is often added under a category that was never
// explicitly POSTed to /api/categories (e.g. one derived from the bundled media
// manifest, like "Abstract"/"City"/"Nature"), so this can't require it to pre-exist.
app.post("/api/categories/:category/folders", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "name is required" });
  let category = db.categories.find((c) => c.name === req.params.category);
  if (!category) {
    category = { name: req.params.category, folders: [] };
    db.categories.push(category);
  }
  if (!category.folders.some((f) => f.toLowerCase() === name.toLowerCase())) {
    category.folders.push(name);
  }
  persist();
  res.status(201).json({ name });
});

function requireNote(req, res, next) {
  const note = db.notes.find((n) => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: "note not found" });
  req.note = note;
  next();
}

app.get("/api/notes", (req, res) => {
  res.json(db.notes);
});

app.post("/api/notes", (req, res) => {
  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const now = Date.now();
  const note = {
    id: `note:${randomUUID()}`,
    title,
    color: "#ffffff",
    pinned: false,
    blocks: [],
    createdAt: now,
    updatedAt: now,
  };
  db.notes.push(note);
  persist();
  res.status(201).json(note);
});

// Partial update — the client sends only the fields it changed (title/color/pinned/blocks).
app.put("/api/notes/:id", requireNote, (req, res) => {
  const body = req.body ?? {};
  if (typeof body.title === "string") req.note.title = body.title.trim();
  if (typeof body.color === "string") req.note.color = body.color;
  if (typeof body.pinned === "boolean") req.note.pinned = body.pinned;
  if (Array.isArray(body.blocks)) req.note.blocks = body.blocks;
  req.note.updatedAt = Date.now();
  persist();
  res.json(req.note);
});

app.delete("/api/notes/:id", requireNote, (req, res) => {
  db.notes = db.notes.filter((n) => n.id !== req.params.id);
  persist();
  res.status(204).end();
});

function requireBill(req, res, next) {
  const bill = db.bills.find((b) => b.id === req.params.id);
  if (!bill) return res.status(404).json({ error: "bill not found" });
  req.bill = bill;
  next();
}

function formatToday() {
  const d = new Date();
  return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
}

app.get("/api/bills", (req, res) => {
  res.json(db.bills);
});

// Defaults mirror the Vrinda Aluminium Fabricators sample bill this module was modeled on —
// company fields rarely change between bills, so prefilling them saves re-typing every time.
app.post("/api/bills", (req, res) => {
  const docType = req.body?.docType === "quotation" ? "quotation" : "bill";
  const now = Date.now();
  const bill = {
    id: `bill:${randomUUID()}`,
    docType,
    date: formatToday(),
    billNo: "",
    companyLogoMediaItemId: null,
    companyName: "VRINDHA",
    companyTagline: "ALUMINIUM FABRICATORS",
    companyAddress:
      "Elayidath Arrakaparambu, Eroor West P.O, Thripunithura, Pin 682306",
    companyPhone: "9447745149, 7907857896",
    recipientName: "",
    recipientAddress: "",
    salutation: "Dear Sir,",
    introText:
      "We have great pleasure to quote our lowest rate of your following works.",
    items: [
      {
        id: randomUUID(),
        text: "",
        amount: "",
        fullWidth: false,
        align: "left",
        indent: 0,
        amountAlign: "right",
        amountIndent: 0,
      },
    ],
    signOffText: "Yours faithfully",
    signerName: "",
    signatureMediaItemId: null,
    footerText:
      "Doors, Windows, Partitions, Hand Rails, Showcase, Hall Ceiling etc.",
    createdAt: now,
    updatedAt: now,
  };
  db.bills.push(bill);
  persist();
  res.status(201).json(bill);
});

const BILL_STRING_FIELDS = [
  "date",
  "billNo",
  "companyName",
  "companyTagline",
  "companyAddress",
  "companyPhone",
  "recipientName",
  "recipientAddress",
  "salutation",
  "introText",
  "signOffText",
  "signerName",
  "footerText",
];

// Partial update — the client sends only the fields it changed.
app.put("/api/bills/:id", requireBill, (req, res) => {
  const body = req.body ?? {};
  if (body.docType === "bill" || body.docType === "quotation")
    req.bill.docType = body.docType;
  for (const field of BILL_STRING_FIELDS) {
    if (typeof body[field] === "string") req.bill[field] = body[field];
  }
  if (
    body.companyLogoMediaItemId === null ||
    typeof body.companyLogoMediaItemId === "string"
  ) {
    req.bill.companyLogoMediaItemId = body.companyLogoMediaItemId;
  }
  if (
    body.signatureMediaItemId === null ||
    typeof body.signatureMediaItemId === "string"
  ) {
    req.bill.signatureMediaItemId = body.signatureMediaItemId;
  }
  if (Array.isArray(body.items)) {
    req.bill.items = body.items
      .filter(
        (it) =>
          it && typeof it.text === "string" && typeof it.amount === "string",
      )
      .map((it) => ({
        id: typeof it.id === "string" ? it.id : randomUUID(),
        text: it.text,
        amount: it.amount,
        fullWidth: it.fullWidth === true,
        align:
          it.align === "center" || it.align === "right" ? it.align : "left",
        indent:
          Number.isInteger(it.indent) && it.indent >= 0 && it.indent <= 4
            ? it.indent
            : 0,
        amountAlign:
          it.amountAlign === "left" || it.amountAlign === "center"
            ? it.amountAlign
            : "right",
        amountIndent:
          Number.isInteger(it.amountIndent) &&
          it.amountIndent >= 0 &&
          it.amountIndent <= 4
            ? it.amountIndent
            : 0,
      }));
  }
  req.bill.updatedAt = Date.now();
  persist();
  res.json(req.bill);
});

app.delete("/api/bills/:id", requireBill, (req, res) => {
  db.bills = db.bills.filter((b) => b.id !== req.params.id);
  persist();
  res.status(204).end();
});

function requireBook(req, res, next) {
  const book = db.books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ error: "book not found" });
  req.book = book;
  next();
}

function requireBookPage(req, res, next) {
  const page = db.bookPages.find(
    (p) => p.id === req.params.pageId && p.bookId === req.params.id,
  );
  if (!page) return res.status(404).json({ error: "page not found" });
  req.page = page;
  next();
}

app.get("/api/books", (req, res) => {
  res.json(db.books);
});

app.post("/api/books", (req, res) => {
  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ error: "title is required" });
  const now = Date.now();
  const book = {
    id: `book:${randomUUID()}`,
    title,
    coverColor: "#1a73e8",
    pageLimit: null,
    pageCount: 1,
    createdAt: now,
    updatedAt: now,
  };
  db.books.push(book);
  db.bookPages.push({
    id: `page:${randomUUID()}`,
    bookId: book.id,
    index: 0,
    background: "#ffffff",
    elements: [],
  });
  persist();
  res.status(201).json(book);
});

app.put("/api/books/:id", requireBook, (req, res) => {
  const body = req.body ?? {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return res.status(400).json({ error: "title is required" });
    req.book.title = title;
  }
  if (typeof body.coverColor === "string")
    req.book.coverColor = body.coverColor;
  if (body.pageLimit === null || Number.isInteger(body.pageLimit))
    req.book.pageLimit = body.pageLimit;
  req.book.updatedAt = Date.now();
  persist();
  res.json(req.book);
});

app.delete("/api/books/:id", requireBook, (req, res) => {
  db.books = db.books.filter((b) => b.id !== req.params.id);
  db.bookPages = db.bookPages.filter((p) => p.bookId !== req.params.id);
  persist();
  res.status(204).end();
});

app.get("/api/books/:id/pages", requireBook, (req, res) => {
  const pages = db.bookPages
    .filter((p) => p.bookId === req.params.id)
    .sort((a, b) => a.index - b.index);
  res.json(pages);
});

app.post("/api/books/:id/pages", requireBook, (req, res) => {
  const pages = db.bookPages.filter((p) => p.bookId === req.params.id);
  if (req.book.pageLimit !== null && pages.length >= req.book.pageLimit) {
    return res
      .status(400)
      .json({ error: `Page limit (${req.book.pageLimit}) reached` });
  }
  const page = {
    id: `page:${randomUUID()}`,
    bookId: req.book.id,
    index: pages.length,
    background: "#ffffff",
    elements: [],
  };
  db.bookPages.push(page);
  req.book.pageCount = pages.length + 1;
  req.book.updatedAt = Date.now();
  persist();
  res.status(201).json(page);
});

app.put(
  "/api/books/:id/pages/:pageId",
  requireBook,
  requireBookPage,
  (req, res) => {
    const body = req.body ?? {};
    if (typeof body.background === "string")
      req.page.background = body.background;
    if (Array.isArray(body.elements)) req.page.elements = body.elements;
    req.book.updatedAt = Date.now();
    persist();
    res.json(req.page);
  },
);

app.delete(
  "/api/books/:id/pages/:pageId",
  requireBook,
  requireBookPage,
  (req, res) => {
    db.bookPages = db.bookPages.filter((p) => p.id !== req.params.pageId);
    // Renumber the remaining pages so page numbers stay contiguous after a deletion.
    const remaining = db.bookPages
      .filter((p) => p.bookId === req.params.id)
      .sort((a, b) => a.index - b.index);
    remaining.forEach((p, i) => {
      p.index = i;
    });
    req.book.pageCount = remaining.length;
    req.book.updatedAt = Date.now();
    persist();
    res.status(204).end();
  },
);

const SECTION_COLORS = [
  "#1e90ff",
  "#22b24c",
  "#d11f2f",
  "#f59e0b",
  "#8b5cf6",
  "#0891b2",
];

// Text HTML is sanitized client-side (DOMPurify) before it's sent and again before render;
// link URLs are restricted to http(s) here so a stored `javascript:` href can never render.
function sanitizeTaskBlock(block) {
  if (!block || typeof block.id !== "string") return null;
  if (block.type === "text" && typeof block.html === "string") {
    return { id: block.id, type: "text", html: block.html };
  }
  if (block.type === "image" && typeof block.mediaItemId === "string") {
    return { id: block.id, type: "image", mediaItemId: block.mediaItemId };
  }
  if (
    block.type === "link" &&
    typeof block.url === "string" &&
    /^https?:\/\//i.test(block.url)
  ) {
    return {
      id: block.id,
      type: "link",
      url: block.url,
      label: typeof block.label === "string" ? block.label : block.url,
    };
  }
  return null;
}

function requireTaskSection(req, res, next) {
  const section = db.taskSections.find((s) => s.id === req.params.id);
  if (!section) return res.status(404).json({ error: "section not found" });
  req.section = section;
  next();
}

function requireTask(req, res, next) {
  const task = db.tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "task not found" });
  req.task = task;
  next();
}

app.get("/api/task-sections", (req, res) => {
  res.json(db.taskSections);
});

app.post("/api/task-sections", (req, res) => {
  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ error: "title is required" });
  const section = {
    id: `section:${randomUUID()}`,
    title,
    color: SECTION_COLORS[db.taskSections.length % SECTION_COLORS.length],
    createdAt: Date.now(),
  };
  db.taskSections.push(section);
  persist();
  res.status(201).json(section);
});

app.put("/api/task-sections/:id", requireTaskSection, (req, res) => {
  const body = req.body ?? {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return res.status(400).json({ error: "title is required" });
    req.section.title = title;
  }
  if (typeof body.color === "string") req.section.color = body.color;
  persist();
  res.json(req.section);
});

app.delete("/api/task-sections/:id", requireTaskSection, (req, res) => {
  db.taskSections = db.taskSections.filter((s) => s.id !== req.params.id);
  db.tasks = db.tasks.filter((t) => t.sectionId !== req.params.id);
  persist();
  res.status(204).end();
});

app.get("/api/tasks", (req, res) => {
  res.json(db.tasks);
});

app.post("/api/tasks", (req, res) => {
  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ error: "title is required" });
  if (!db.taskSections.some((s) => s.id === req.body?.sectionId)) {
    return res.status(400).json({ error: "valid sectionId is required" });
  }
  const now = Date.now();
  const task = {
    id: `task:${randomUUID()}`,
    sectionId: req.body.sectionId,
    title,
    blocks: [],
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
  db.tasks.push(task);
  persist();
  res.status(201).json(task);
});

// Partial update — also how a task moves between sections (sectionId); a moved task goes
// to the end of its new section because array order is display order.
app.put("/api/tasks/:id", requireTask, (req, res) => {
  const body = req.body ?? {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return res.status(400).json({ error: "title is required" });
    req.task.title = title;
  }
  if (Array.isArray(body.blocks))
    req.task.blocks = body.blocks.map(sanitizeTaskBlock).filter(Boolean);
  if (typeof body.completed === "boolean") req.task.completed = body.completed;
  if (
    typeof body.sectionId === "string" &&
    body.sectionId !== req.task.sectionId
  ) {
    if (!db.taskSections.some((s) => s.id === body.sectionId)) {
      return res.status(400).json({ error: "section not found" });
    }
    req.task.sectionId = body.sectionId;
    db.tasks = [...db.tasks.filter((t) => t.id !== req.task.id), req.task];
  }
  req.task.updatedAt = Date.now();
  persist();
  res.json(req.task);
});

app.delete("/api/tasks/:id", requireTask, (req, res) => {
  db.tasks = db.tasks.filter((t) => t.id !== req.params.id);
  persist();
  res.status(204).end();
});

function requireTextChat(req, res, next) {
  const chat = db.textChats.find((c) => c.id === req.params.id);
  if (!chat) return res.status(404).json({ error: "conversation not found" });
  req.textChat = chat;
  next();
}

// Text HTML is sanitized client-side (DOMPurify) before it's ever sent and again before
// render (see SentenceTextBlock.tsx) — the server treats it as opaque, same model as
// Notes'/Tasks' text blocks. Attachments are opaque references to a library MediaItem id.
function sanitizeTextChatMessage(message) {
  if (
    !message ||
    typeof message.id !== "string" ||
    typeof message.html !== "string"
  ) {
    return null;
  }
  const attachments = Array.isArray(message.attachments)
    ? message.attachments
        .filter(
          (a) =>
            a && typeof a.id === "string" && typeof a.mediaItemId === "string",
        )
        .map((a) => ({ id: a.id, mediaItemId: a.mediaItemId }))
    : [];
  return {
    id: message.id,
    html: message.html,
    highlighted: Boolean(message.highlighted),
    attachments,
    createdAt:
      typeof message.createdAt === "number" ? message.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
}

app.get("/api/text-chats", (req, res) => {
  res.json(db.textChats);
});

app.post("/api/text-chats", (req, res) => {
  const name =
    typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const now = Date.now();
  const conversation = {
    id: `textchat:${randomUUID()}`,
    name: name || "Untitled conversation",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  db.textChats.push(conversation);
  persist();
  res.status(201).json(conversation);
});

// Partial update — the client sends only the fields it changed (name/messages), same
// model as Notes'/Tasks' PUT. Combining two conversations is a PUT with the merged
// messages array followed by a DELETE of the other conversation, client-side (see
// useTextChats' combineConversations) — no dedicated endpoint.
app.put("/api/text-chats/:id", requireTextChat, (req, res) => {
  const body = req.body ?? {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name) req.textChat.name = name;
  }
  if (Array.isArray(body.messages)) {
    req.textChat.messages = body.messages
      .map(sanitizeTextChatMessage)
      .filter(Boolean);
  }
  req.textChat.updatedAt = Date.now();
  persist();
  res.json(req.textChat);
});

app.delete("/api/text-chats/:id", requireTextChat, (req, res) => {
  db.textChats = db.textChats.filter((c) => c.id !== req.params.id);
  persist();
  res.status(204).end();
});

function sanitizeHighlightRects(rects) {
  if (!Array.isArray(rects)) return null;
  const clean = rects
    .filter(
      (r) =>
        r &&
        ["x", "y", "w", "h"].every(
          (k) => typeof r[k] === "number" && Number.isFinite(r[k]),
        ),
    )
    .map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h }));
  return clean.length > 0 ? clean : null;
}

// PDF text highlights — see src/types/pdf.ts. Filtered by mediaItemId (a query param, not
// a route segment) since the server has no "PDF" resource of its own to nest under —
// mediaItemId is a client-side MediaItem id it never otherwise sees.
app.get("/api/pdf-highlights", (req, res) => {
  const { mediaItemId } = req.query;
  const highlights =
    typeof mediaItemId === "string"
      ? db.pdfHighlights.filter((h) => h.mediaItemId === mediaItemId)
      : db.pdfHighlights;
  res.json(highlights);
});

app.post("/api/pdf-highlights", (req, res) => {
  const body = req.body ?? {};
  const mediaItemId =
    typeof body.mediaItemId === "string" ? body.mediaItemId : "";
  const page = Number.isInteger(body.page) && body.page > 0 ? body.page : null;
  const rects = sanitizeHighlightRects(body.rects);
  const color = typeof body.color === "string" ? body.color : "#fef08a";
  const text = typeof body.text === "string" ? body.text : "";
  if (!mediaItemId || !page || !rects) {
    return res
      .status(400)
      .json({ error: "mediaItemId, page, and rects are required" });
  }
  const highlight = {
    id: `pdfhl:${randomUUID()}`,
    mediaItemId,
    page,
    rects,
    color,
    text,
    createdAt: Date.now(),
  };
  db.pdfHighlights.push(highlight);
  persist();
  res.status(201).json(highlight);
});

app.delete("/api/pdf-highlights/:id", (req, res) => {
  const before = db.pdfHighlights.length;
  db.pdfHighlights = db.pdfHighlights.filter((h) => h.id !== req.params.id);
  if (db.pdfHighlights.length === before) {
    return res.status(404).json({ error: "highlight not found" });
  }
  persist();
  res.status(204).end();
});

// Movies — see src/types/movie.ts. Clips/header/footer are validated shape-wise (known
// fields only, bad ones fall back to a default) but not otherwise interpreted — same
// "opaque to the server" spirit as Bills' items and Books' page elements.

const MOVIE_ASPECTS = ["16:9", "9:16", "1:1", "4:3"];
const TRANSITION_TYPES = [
  "none",
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
  "zoom",
];
const IDLE_ANIMATION_TYPES = [
  "none",
  "kenburns-in",
  "kenburns-out",
  "shake",
  "tilt3d",
];

const DEFAULT_BAND = {
  enabled: false,
  text: "",
  size: 72,
  background: "#111827",
  color: "#ffffff",
  fontSize: 32,
  fontFamily: "sans-serif",
  bold: true,
  italic: false,
  uppercase: false,
  align: "center",
  borderWidth: 0,
  borderColor: "#ffffff",
  opacity: 1,
};

function sanitizeBand(raw, fallback) {
  const b = raw && typeof raw === "object" ? raw : {};
  const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    enabled: typeof b.enabled === "boolean" ? b.enabled : fallback.enabled,
    text: typeof b.text === "string" ? b.text : fallback.text,
    size: num(b.size, fallback.size),
    background:
      typeof b.background === "string" ? b.background : fallback.background,
    color: typeof b.color === "string" ? b.color : fallback.color,
    fontSize: num(b.fontSize, fallback.fontSize),
    fontFamily:
      typeof b.fontFamily === "string" ? b.fontFamily : fallback.fontFamily,
    bold: typeof b.bold === "boolean" ? b.bold : fallback.bold,
    italic: typeof b.italic === "boolean" ? b.italic : fallback.italic,
    uppercase:
      typeof b.uppercase === "boolean" ? b.uppercase : fallback.uppercase,
    align: ["left", "center", "right"].includes(b.align)
      ? b.align
      : fallback.align,
    borderWidth: num(b.borderWidth, fallback.borderWidth),
    borderColor:
      typeof b.borderColor === "string" ? b.borderColor : fallback.borderColor,
    opacity: num(b.opacity, fallback.opacity),
  };
}

function sanitizeDialogue(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.text !== "string")
    return null;
  const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    id: typeof raw.id === "string" ? raw.id : randomUUID(),
    text: raw.text,
    startSec: Math.max(0, num(raw.startSec, 0)),
    endSec: Math.max(0, num(raw.endSec, 1)),
    attachedObjectId:
      typeof raw.attachedObjectId === "string" ? raw.attachedObjectId : null,
    x: Math.min(1, Math.max(0, num(raw.x, 0.5))),
    y: Math.min(1, Math.max(0, num(raw.y, 0.5))),
    bubbleColor:
      typeof raw.bubbleColor === "string" ? raw.bubbleColor : "#ffffff",
    textColor: typeof raw.textColor === "string" ? raw.textColor : "#111827",
    fontSize: Math.max(8, num(raw.fontSize, 40)),
    fontFamily:
      typeof raw.fontFamily === "string" ? raw.fontFamily : "sans-serif",
    style: raw.style === "caption" ? "caption" : "bubble",
  };
}

// A clip is a scene that can hold several positioned objects (e.g. two characters in
// frame at once, each independently animated) — see src/types/movie.ts's ClipObject.
function sanitizeObject(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.mediaItemId !== "string")
    return null;
  const kind =
    raw.kind === "video" ? "video" : raw.kind === "image" ? "image" : null;
  if (!kind) return null;
  const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const idleRaw =
    raw.idleAnimation && typeof raw.idleAnimation === "object"
      ? raw.idleAnimation
      : {};
  return {
    id: typeof raw.id === "string" ? raw.id : randomUUID(),
    kind,
    mediaItemId: raw.mediaItemId,
    x: Math.min(1, Math.max(0, num(raw.x, 0.5))),
    y: Math.min(1, Math.max(0, num(raw.y, 0.5))),
    width: Math.min(1, Math.max(0.05, num(raw.width, 0.5))),
    trimStart: Math.max(0, num(raw.trimStart, 0)),
    muted: raw.muted === true,
    idleAnimation: {
      type: IDLE_ANIMATION_TYPES.includes(idleRaw.type) ? idleRaw.type : "none",
      intensity: Math.min(100, Math.max(0, num(idleRaw.intensity, 30))),
    },
    startSec: Math.max(0, num(raw.startSec, 0)),
    endSec: Math.max(0, num(raw.endSec, 1e6)),
  };
}

function sanitizeClip(raw) {
  if (!raw || typeof raw !== "object") return null;
  const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const objects = Array.isArray(raw.objects)
    ? raw.objects.map(sanitizeObject).filter(Boolean)
    : [];
  return {
    id: typeof raw.id === "string" ? raw.id : randomUUID(),
    duration: Math.max(0.1, num(raw.duration, 3)),
    transitionIn: TRANSITION_TYPES.includes(raw.transitionIn)
      ? raw.transitionIn
      : "none",
    transitionOut: TRANSITION_TYPES.includes(raw.transitionOut)
      ? raw.transitionOut
      : "none",
    objects,
    dialogues: Array.isArray(raw.dialogues)
      ? raw.dialogues.map(sanitizeDialogue).filter(Boolean)
      : [],
  };
}

function requireMovie(req, res, next) {
  const movie = db.movies.find((m) => m.id === req.params.id);
  if (!movie) return res.status(404).json({ error: "movie not found" });
  req.movie = movie;
  next();
}

app.get("/api/movies", (req, res) => {
  res.json(db.movies);
});

app.post("/api/movies", (req, res) => {
  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ error: "title is required" });
  const now = Date.now();
  const movie = {
    id: `movie:${randomUUID()}`,
    title,
    clips: [],
    aspect: MOVIE_ASPECTS.includes(req.body?.aspect) ? req.body.aspect : "16:9",
    background: "#000000",
    header: { ...DEFAULT_BAND },
    footer: { ...DEFAULT_BAND },
    createdAt: now,
    updatedAt: now,
  };
  db.movies.push(movie);
  persist();
  res.status(201).json(movie);
});

// Partial update — the client sends only the fields it changed, same as Bills/Tasks.
app.put("/api/movies/:id", requireMovie, (req, res) => {
  const body = req.body ?? {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return res.status(400).json({ error: "title is required" });
    req.movie.title = title;
  }
  if (MOVIE_ASPECTS.includes(body.aspect)) req.movie.aspect = body.aspect;
  if (typeof body.background === "string")
    req.movie.background = body.background;
  if (body.header !== undefined) {
    req.movie.header = sanitizeBand(body.header, req.movie.header);
  }
  if (body.footer !== undefined) {
    req.movie.footer = sanitizeBand(body.footer, req.movie.footer);
  }
  if (Array.isArray(body.clips)) {
    req.movie.clips = body.clips.map(sanitizeClip).filter(Boolean);
  }
  req.movie.updatedAt = Date.now();
  persist();
  res.json(req.movie);
});

app.delete("/api/movies/:id", requireMovie, (req, res) => {
  db.movies = db.movies.filter((m) => m.id !== req.params.id);
  persist();
  res.status(204).end();
});

// Slideshow module — see src/types/movie.ts. A slideshow is stored exactly like a Movie
// (same shape, same sanitizeBand/sanitizeClip helpers above) in its own collection, so its
// list stays separate from Movies' even though both are edited/exported through the same
// MovieWorkspace component client-side.
function requireSlideshow(req, res, next) {
  const slideshow = db.slideshows.find((s) => s.id === req.params.id);
  if (!slideshow) {
    return res.status(404).json({ error: "slideshow not found" });
  }
  req.slideshow = slideshow;
  next();
}

app.get("/api/slideshows", (req, res) => {
  res.json(db.slideshows);
});

app.post("/api/slideshows", (req, res) => {
  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ error: "title is required" });
  const now = Date.now();
  const slideshow = {
    id: `slideshow:${randomUUID()}`,
    title,
    clips: [],
    aspect: MOVIE_ASPECTS.includes(req.body?.aspect) ? req.body.aspect : "16:9",
    background: "#000000",
    header: { ...DEFAULT_BAND },
    footer: { ...DEFAULT_BAND },
    createdAt: now,
    updatedAt: now,
  };
  db.slideshows.push(slideshow);
  persist();
  res.status(201).json(slideshow);
});

// Partial update — the client sends only the fields it changed, same as Movies.
app.put("/api/slideshows/:id", requireSlideshow, (req, res) => {
  const body = req.body ?? {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return res.status(400).json({ error: "title is required" });
    req.slideshow.title = title;
  }
  if (MOVIE_ASPECTS.includes(body.aspect)) req.slideshow.aspect = body.aspect;
  if (typeof body.background === "string") {
    req.slideshow.background = body.background;
  }
  if (body.header !== undefined) {
    req.slideshow.header = sanitizeBand(body.header, req.slideshow.header);
  }
  if (body.footer !== undefined) {
    req.slideshow.footer = sanitizeBand(body.footer, req.slideshow.footer);
  }
  if (Array.isArray(body.clips)) {
    req.slideshow.clips = body.clips.map(sanitizeClip).filter(Boolean);
  }
  req.slideshow.updatedAt = Date.now();
  persist();
  res.json(req.slideshow);
});

app.delete("/api/slideshows/:id", requireSlideshow, (req, res) => {
  db.slideshows = db.slideshows.filter((s) => s.id !== req.params.id);
  persist();
  res.status(204).end();
});

// Custom APIs module — see src/types/customEndpoint.ts. Management (list/create/edit/
// delete) goes through the normal authenticated, customer-scoped routes below, like every
// other module. The endpoints these define are *served* by a separate, deliberately public
// route further down (app.all("/api/custom/:customerId/*", ...)), which reads a customer's
// collection directly via getCustomerDb rather than the request-scoped `db` proxy, since a
// public caller never goes through resolveAuthAndCustomer at all.
const CUSTOM_ENDPOINT_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const CUSTOM_ENDPOINT_CONTENT_TYPES = [
  "application/json",
  "text/plain",
  "text/html",
];

function normalizeEndpointPath(raw) {
  return typeof raw === "string" ? raw.trim().replace(/^\/+|\/+$/g, "") : "";
}

function requireCustomEndpoint(req, res, next) {
  const endpoint = db.customEndpoints.find((e) => e.id === req.params.id);
  if (!endpoint) {
    return res.status(404).json({ error: "endpoint not found" });
  }
  req.customEndpoint = endpoint;
  next();
}

app.get("/api/custom-endpoints", (req, res) => {
  res.json(db.customEndpoints);
});

app.post("/api/custom-endpoints", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const path = normalizeEndpointPath(req.body?.path);
  if (!name) return res.status(400).json({ error: "name is required" });
  if (!path) return res.status(400).json({ error: "path is required" });
  const now = Date.now();
  const endpoint = {
    id: `endpoint:${randomUUID()}`,
    name,
    method: CUSTOM_ENDPOINT_METHODS.includes(req.body?.method)
      ? req.body.method
      : "GET",
    path,
    enabled: true,
    statusCode: Number.isInteger(req.body?.statusCode)
      ? req.body.statusCode
      : 200,
    contentType: CUSTOM_ENDPOINT_CONTENT_TYPES.includes(req.body?.contentType)
      ? req.body.contentType
      : "application/json",
    body: typeof req.body?.body === "string" ? req.body.body : "{}",
    createdAt: now,
    updatedAt: now,
  };
  db.customEndpoints.push(endpoint);
  persist();
  res.status(201).json(endpoint);
});

// Partial update — the client sends only the fields it changed, same as every other module.
app.put("/api/custom-endpoints/:id", requireCustomEndpoint, (req, res) => {
  const body = req.body ?? {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return res.status(400).json({ error: "name is required" });
    req.customEndpoint.name = name;
  }
  if (typeof body.path === "string") {
    const path = normalizeEndpointPath(body.path);
    if (!path) return res.status(400).json({ error: "path is required" });
    req.customEndpoint.path = path;
  }
  if (CUSTOM_ENDPOINT_METHODS.includes(body.method)) {
    req.customEndpoint.method = body.method;
  }
  if (typeof body.enabled === "boolean") req.customEndpoint.enabled = body.enabled;
  if (Number.isInteger(body.statusCode)) {
    req.customEndpoint.statusCode = body.statusCode;
  }
  if (CUSTOM_ENDPOINT_CONTENT_TYPES.includes(body.contentType)) {
    req.customEndpoint.contentType = body.contentType;
  }
  if (typeof body.body === "string") req.customEndpoint.body = body.body;
  req.customEndpoint.updatedAt = Date.now();
  persist();
  res.json(req.customEndpoint);
});

app.delete("/api/custom-endpoints/:id", requireCustomEndpoint, (req, res) => {
  db.customEndpoints = db.customEndpoints.filter((e) => e.id !== req.params.id);
  persist();
  res.status(204).end();
});

// The actual public API surface: no auth, no customer session — just a customerId in the
// URL to pick whose endpoint collection to look in (a routing key, not a secret; these are
// meant to be public by design). app.all matches every HTTP method on one handler so a
// single matching pass can check the stored endpoint's own method.
app.all("/api/custom/:customerId/*", (req, res) => {
  const customer = topDb.customers.find((c) => c.id === req.params.customerId);
  if (!customer) return res.status(404).json({ error: "not found" });
  const calledPath = normalizeEndpointPath(req.params[0]);
  const customerDb = getCustomerDb(customer.id);
  const endpoint = (customerDb.customEndpoints ?? []).find(
    (e) => e.enabled && e.method === req.method && e.path === calledPath,
  );
  if (!endpoint) {
    return res.status(404).json({ error: "no matching custom endpoint" });
  }
  res.status(endpoint.statusCode).type(endpoint.contentType).send(endpoint.body);
});

// Uploaded media (photos/videos/PDFs) — see src/types/media.ts and mediaStorage.mjs.
// This is the one place in the API that handles real file bytes, not just JSON;
// the on-disk filename is always a fresh random token, independent of the
// record's logical `id`, so an `id` containing ":" (e.g. "media:<uuid>") never
// has to be sanitized into a filesystem-safe form.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, currentUploadsDir()),
    filename: (req, file, cb) =>
      cb(null, `${randomUUID()}${extname(file.originalname)}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
});

function requireMediaRecord(req, res, next) {
  const record = db.media.find((m) => m.id === req.params.id);
  if (!record) return res.status(404).json({ error: "media not found" });
  req.mediaRecord = record;
  next();
}

app.get("/api/media", (req, res) => {
  res.json(db.media);
});

// `id` is optional and only ever sent by the one-time IndexedDB -> server
// migration (src/lib/migrateImportedMedia.ts), so a migrated item keeps the
// same id every other module's stored `mediaItemId`/`attachmentIds` already
// point at, instead of becoming a dangling reference.
app.post("/api/media", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });
  const requestedId =
    typeof req.body?.id === "string" ? req.body.id.trim() : "";
  const id =
    requestedId && !db.media.some((m) => m.id === requestedId)
      ? requestedId
      : `media:${randomUUID()}`;
  const type = ["image", "video", "pdf"].includes(req.body?.type)
    ? req.body.type
    : "image";
  const title =
    typeof req.body?.title === "string" && req.body.title.trim()
      ? req.body.title.trim()
      : req.file.originalname;
  const category =
    typeof req.body?.category === "string" && req.body.category.trim()
      ? req.body.category.trim()
      : "Imported";
  const record = {
    id,
    type,
    title,
    category,
    filename: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    createdAt: Date.now(),
  };
  db.media.push(record);
  persist();
  res.status(201).json(record);
});

// res.sendFile handles Range requests (needed for video scrubbing) and infers
// Content-Type from the extension on its own.
app.get("/api/media/:id/file", requireMediaRecord, (req, res) => {
  res.sendFile(join(currentUploadsDir(), req.mediaRecord.filename), (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: "file not found on disk" });
    }
  });
});

app.delete("/api/media/:id", requireMediaRecord, (req, res) => {
  deleteUploadedFile(req.mediaRecord.filename);
  db.media = db.media.filter((m) => m.id !== req.params.id);
  persist();
  res.status(204).end();
});

// Website Builder — see src/types/website.ts. Mirrors the Books routes above
// (sites/sitePages are sibling flat collections, not nested) one level deeper:
// a page's header/hero/sections/footer tree is accepted and stored as-is, with
// no server-side shape validation, same "opaque to the server" model as
// Notes'/Tasks' blocks and Books' elements.
function requireSite(req, res, next) {
  const site = db.sites.find((s) => s.id === req.params.id);
  if (!site) return res.status(404).json({ error: "site not found" });
  req.site = site;
  next();
}

function requireSitePage(req, res, next) {
  const page = db.sitePages.find(
    (p) => p.id === req.params.pageId && p.siteId === req.params.id,
  );
  if (!page) return res.status(404).json({ error: "page not found" });
  req.sitePage = page;
  next();
}

app.get("/api/sites", (req, res) => {
  res.json(db.sites);
});

app.post("/api/sites", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "name is required" });
  const now = Date.now();
  const site = {
    id: `site:${randomUUID()}`,
    name,
    faviconMediaId: null,
    themeColor: "#1a73e8",
    pageCount: 1,
    createdAt: now,
    updatedAt: now,
  };
  db.sites.push(site);
  db.sitePages.push({
    id: `sitepage:${randomUUID()}`,
    siteId: site.id,
    index: 0,
    title: "Home",
    slug: "",
    header: null,
    hero: null,
    sections: [],
    footer: null,
  });
  persist();
  res.status(201).json(site);
});

app.put("/api/sites/:id", requireSite, (req, res) => {
  const body = req.body ?? {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return res.status(400).json({ error: "name is required" });
    req.site.name = name;
  }
  if (typeof body.faviconMediaId === "string" || body.faviconMediaId === null)
    req.site.faviconMediaId = body.faviconMediaId;
  if (typeof body.themeColor === "string") req.site.themeColor = body.themeColor;
  req.site.updatedAt = Date.now();
  persist();
  res.json(req.site);
});

app.delete("/api/sites/:id", requireSite, (req, res) => {
  db.sites = db.sites.filter((s) => s.id !== req.params.id);
  db.sitePages = db.sitePages.filter((p) => p.siteId !== req.params.id);
  persist();
  res.status(204).end();
});

app.get("/api/sites/:id/pages", requireSite, (req, res) => {
  const pages = db.sitePages
    .filter((p) => p.siteId === req.params.id)
    .sort((a, b) => a.index - b.index);
  res.json(pages);
});

app.post("/api/sites/:id/pages", requireSite, (req, res) => {
  const pages = db.sitePages.filter((p) => p.siteId === req.params.id);
  const title =
    typeof req.body?.title === "string" && req.body.title.trim()
      ? req.body.title.trim()
      : `Page ${pages.length + 1}`;
  const slug =
    typeof req.body?.slug === "string"
      ? req.body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")
      : "";
  const page = {
    id: `sitepage:${randomUUID()}`,
    siteId: req.site.id,
    index: pages.length,
    title,
    slug,
    header: null,
    hero: null,
    sections: [],
    footer: null,
  };
  db.sitePages.push(page);
  req.site.pageCount = pages.length + 1;
  req.site.updatedAt = Date.now();
  persist();
  res.status(201).json(page);
});

app.put(
  "/api/sites/:id/pages/:pageId",
  requireSite,
  requireSitePage,
  (req, res) => {
    const body = req.body ?? {};
    if (typeof body.title === "string") req.sitePage.title = body.title.trim();
    if (typeof body.slug === "string") req.sitePage.slug = body.slug;
    if (body.header === null || typeof body.header === "object")
      req.sitePage.header = body.header;
    if (body.hero === null || typeof body.hero === "object")
      req.sitePage.hero = body.hero;
    if (Array.isArray(body.sections)) req.sitePage.sections = body.sections;
    if (body.footer === null || typeof body.footer === "object")
      req.sitePage.footer = body.footer;
    if (typeof body.seoDescription === "string")
      req.sitePage.seoDescription = body.seoDescription;
    req.site.updatedAt = Date.now();
    persist();
    res.json(req.sitePage);
  },
);

app.delete(
  "/api/sites/:id/pages/:pageId",
  requireSite,
  requireSitePage,
  (req, res) => {
    db.sitePages = db.sitePages.filter((p) => p.id !== req.params.pageId);
    const remaining = db.sitePages
      .filter((p) => p.siteId === req.params.id)
      .sort((a, b) => a.index - b.index);
    remaining.forEach((p, i) => {
      p.index = i;
    });
    req.site.pageCount = remaining.length;
    req.site.updatedAt = Date.now();
    persist();
    res.status(204).end();
  },
);

// Reorders one page among its siblings — unlike Books, whose pages are never
// reordered, the Website Builder's page rail supports drag-reorder.
app.put(
  "/api/sites/:id/pages/:pageId/reorder",
  requireSite,
  requireSitePage,
  (req, res) => {
    const siblings = db.sitePages
      .filter((p) => p.siteId === req.params.id)
      .sort((a, b) => a.index - b.index);
    const from = siblings.findIndex((p) => p.id === req.params.pageId);
    const requested = Number(req.body?.index);
    const to = Number.isInteger(requested)
      ? Math.max(0, Math.min(siblings.length - 1, requested))
      : from;
    const [moved] = siblings.splice(from, 1);
    siblings.splice(to, 0, moved);
    siblings.forEach((p, i) => {
      p.index = i;
    });
    req.site.updatedAt = Date.now();
    persist();
    res.json(siblings);
  },
);

// Reports module — see src/types/report.ts. Everything here is computed on the fly from
// `db` (counts and byte sums), nothing is stored; "storage" only covers uploaded media
// (db.media, which already has an accurate on-disk byte size per file — see
// mediaStorage.mjs) since bundled stock assets under src/assets/ are static build output,
// not something that grows with use, so they aren't meaningful to a usage report.
app.get("/api/reports/summary", (req, res) => {
  const byType = { image: { count: 0, bytes: 0 }, video: { count: 0, bytes: 0 }, pdf: { count: 0, bytes: 0 } };
  const byCategoryMap = new Map();
  for (const record of db.media) {
    const bucket = byType[record.type] ?? byType.image;
    bucket.count += 1;
    bucket.bytes += record.size;
    const cat = byCategoryMap.get(record.category) ?? { category: record.category, count: 0, bytes: 0 };
    cat.count += 1;
    cat.bytes += record.size;
    byCategoryMap.set(record.category, cat);
  }
  const byCategory = Array.from(byCategoryMap.values()).sort((a, b) => b.bytes - a.bytes);
  const largestFiles = [...db.media]
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .map((m) => ({ id: m.id, title: m.title, category: m.category, type: m.type, bytes: m.size }));

  const byContent = db.contents.map((content) => {
    const messages = db.messages.filter((m) => m.contentId === content.id);
    return {
      contentId: content.id,
      name: content.name,
      messages: messages.length,
      users: db.users.filter((u) => u.contentId === content.id).length,
      attachments: messages.reduce((sum, m) => sum + (m.attachmentIds?.length ?? 0), 0),
    };
  });

  const noteBlocks = db.notes.reduce((sum, n) => sum + (n.blocks?.length ?? 0), 0);
  const billItems = db.bills.reduce((sum, b) => sum + (b.items?.length ?? 0), 0);
  const movieClips = db.movies.reduce((sum, m) => sum + (m.clips?.length ?? 0), 0);
  const taskCompleted = db.tasks.filter((t) => t.completed).length;
  const textChatMessages = db.textChats.reduce((sum, c) => sum + (c.messages?.length ?? 0), 0);
  const textChatAttachments = db.textChats.reduce(
    (sum, c) => sum + c.messages.reduce((s, m) => s + (m.attachments?.length ?? 0), 0),
    0,
  );
  const textChatHighlighted = db.textChats.reduce(
    (sum, c) => sum + c.messages.filter((m) => m.highlighted).length,
    0,
  );

  res.json({
    generatedAt: Date.now(),
    storage: {
      totalCount: db.media.length,
      totalBytes: db.media.reduce((sum, m) => sum + m.size, 0),
      byType,
      byCategory,
      largestFiles,
    },
    chat: {
      contents: db.contents.length,
      users: db.users.length,
      messages: db.messages.length,
      attachments: db.messages.reduce((sum, m) => sum + (m.attachmentIds?.length ?? 0), 0),
      byContent,
    },
    notes: { count: db.notes.length, pinned: db.notes.filter((n) => n.pinned).length, blocks: noteBlocks },
    bills: { count: db.bills.length, items: billItems },
    books: { count: db.books.length, pages: db.bookPages.length },
    tasks: { sections: db.taskSections.length, tasks: db.tasks.length, completed: taskCompleted },
    movies: { count: db.movies.length, clips: movieClips },
    websites: { count: db.sites.length, pages: db.sitePages.length },
    pdfHighlights: { count: db.pdfHighlights.length },
    textChats: {
      conversations: db.textChats.length,
      messages: textChatMessages,
      attachments: textChatAttachments,
      highlighted: textChatHighlighted,
    },
  });
});

const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);

// The API Tester module sends requests through here instead of straight from the
// browser: a cross-origin fetch with a custom header (Authorization) or a JSON body
// triggers a CORS preflight, and most APIs under test don't answer it for our origin —
// the browser then silently drops the request before it's sent. A server-to-server
// fetch has no CORS step, so headers/bodies the browser would block always go through.
app.post("/api/api-tester/send", async (req, res) => {
  const { method, url, headers, body } = req.body ?? {};
  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "A URL is required" });
  }

  const outHeaders = new Headers();
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h && typeof h.key === "string" && h.key.trim()) {
        outHeaders.set(h.key.trim(), String(h.value ?? ""));
      }
    }
  }
  const httpMethod = typeof method === "string" ? method.toUpperCase() : "GET";
  const sendBody =
    typeof body === "string" && body.length > 0 && !METHODS_WITHOUT_BODY.has(httpMethod);

  const started = Date.now();
  let upstream;
  try {
    upstream = await fetch(url, {
      method: httpMethod,
      headers: outHeaders,
      body: sendBody ? body : undefined,
    });
  } catch (err) {
    return res
      .status(502)
      .json({ error: err instanceof Error ? err.message : "Request failed" });
  }
  const timeMs = Date.now() - started;

  const buffer = Buffer.from(await upstream.arrayBuffer());
  const responseHeaders = [];
  upstream.headers.forEach((value, key) => responseHeaders.push({ key, value }));

  res.json({
    status: upstream.status,
    statusText: upstream.statusText,
    ok: upstream.ok,
    headers: responseHeaders,
    timeMs,
    bodyBase64: buffer.toString("base64"),
  });
});

// In production, serve the built SPA from the same process so `node server/index.mjs`
// alone can run the whole app — index.html is never cached, matching the project's
// deployment convention.
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(join(DIST_DIR, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Chat API listening on http://localhost:${PORT}`);
});
