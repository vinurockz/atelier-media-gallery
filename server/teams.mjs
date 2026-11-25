// Teams module — teams, channels, group chats, live messages. See src/types/teams.ts.
//
// Unlike every other module, this data is shared *between accounts*, so it can't live in a
// customer's own store (db.mjs): it has its own file, `<dataDir>/teams.json`. That also means
// there's no per-customer isolation to lean on — every route below checks that the signed-in
// user (req.user) may see the thing it names, and answers 404 (not 403) when they may not, so
// ids can't be probed.
import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { extname, join } from "node:path";

const MAX_TEXT = 4000;
const MAX_NAME = 80;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const MAX_CHAT_MEMBERS = 100;

// Only these are shown inline. Anything else (HTML, SVG, ...) is forced to download, so an
// uploaded file can never run script on this site's own origin.
const INLINE_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
};

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function idList(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((v) => typeof v === "string"))]
    : [];
}

/**
 * @param {object} options
 * @param {string} options.dataDir where teams.json and uploaded files are kept
 * @param {() => Array<{id: string, email: string, name: string}>} options.listUsers all accounts
 * @param {(req: import("express").Request) => boolean} options.isSessionActive whether a live
 *   connection's sign-in is still valid (checked before every push)
 */
export function createTeamsRouter({ dataDir, listUsers, isSessionActive }) {
  const dbFile = join(dataDir, "teams.json");
  const filesDir = join(dataDir, "teams-files");
  mkdirSync(filesDir, { recursive: true });

  const empty = {
    teams: [],
    conversations: [],
    messages: [],
    files: [],
    reads: {},
  };
  // A corrupt file must stop startup: carrying on with an empty store would overwrite it.
  const data = existsSync(dbFile)
    ? { ...empty, ...JSON.parse(readFileSync(dbFile, "utf8")) }
    : empty;

  function persist() {
    const tmp = `${dbFile}.tmp`;
    writeFileSync(tmp, JSON.stringify(data), "utf8");
    renameSync(tmp, dbFile);
  }

  const userById = (id) => listUsers().find((u) => u.id === id);
  const userByEmail = (email) => {
    const wanted = cleanText(email, 254).toLowerCase();
    return listUsers().find((u) => u.email === wanted);
  };
  const publicPerson = (id) => {
    const user = userById(id);
    return user
      ? { id, name: user.name, email: user.email }
      : { id, name: "Unknown user", email: "" };
  };

  const memberOfTeam = (team, userId) =>
    team.members.find((m) => m.userId === userId);

  /** The one rule for who can see a conversation — every route and every push uses it. */
  function canAccess(conversation, userId) {
    if (conversation.kind === "chat") {
      return conversation.memberIds.includes(userId);
    }
    const team = data.teams.find((t) => t.id === conversation.teamId);
    if (!team || !memberOfTeam(team, userId)) return false;
    return !conversation.isPrivate || conversation.memberIds.includes(userId);
  }

  const audienceOf = (conversation) => {
    if (conversation.kind === "chat" || conversation.isPrivate) {
      return conversation.memberIds.filter((id) => canAccess(conversation, id));
    }
    const team = data.teams.find((t) => t.id === conversation.teamId);
    return team ? team.members.map((m) => m.userId) : [];
  };

  // --- Live updates (Server-Sent Events). A push only says "something changed" — the
  // client then refetches through the normal, permission-checked routes. ----------------
  const streams = new Map(); // userId -> Set<{ req, res }>

  function push(userIds, event) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const userId of new Set(userIds)) {
      for (const client of streams.get(userId) ?? []) {
        if (isSessionActive(client.req)) client.res.write(payload);
        else client.res.end();
      }
    }
  }

  const onlineIds = () => new Set(streams.keys());

  const everyoneWhoKnows = (userId) => {
    const ids = new Set([userId]);
    for (const team of data.teams) {
      if (memberOfTeam(team, userId)) {
        for (const m of team.members) ids.add(m.userId);
      }
    }
    for (const c of data.conversations) {
      if (c.kind === "chat" && c.memberIds.includes(userId)) {
        for (const id of c.memberIds) ids.add(id);
      }
    }
    return [...ids];
  };

  // --- Serialisation -----------------------------------------------------------------------
  function conversationView(conversation, userId) {
    const lastRead = data.reads[userId]?.[conversation.id] ?? 0;
    let unread = 0;
    let mentions = 0;
    let lastMessageAt = conversation.createdAt;
    for (const m of data.messages) {
      if (m.conversationId !== conversation.id) continue;
      lastMessageAt = Math.max(lastMessageAt, m.createdAt);
      if (m.createdAt > lastRead && m.authorId !== userId && !m.deletedAt) {
        unread += 1;
        if (m.mentionIds.includes(userId)) mentions += 1;
      }
    }
    const online = onlineIds();
    return {
      id: conversation.id,
      kind: conversation.kind,
      teamId: conversation.teamId,
      name: conversation.name,
      isPrivate: conversation.isPrivate,
      createdBy: conversation.createdBy,
      members: audienceOf(conversation).map((id) => ({
        ...publicPerson(id),
        online: online.has(id),
      })),
      unread,
      mentions,
      lastMessageAt,
    };
  }

  function messageView(message) {
    const deleted = Boolean(message.deletedAt);
    return {
      id: message.id,
      conversationId: message.conversationId,
      author: publicPerson(message.authorId),
      parentId: message.parentId,
      text: deleted ? "" : message.text,
      files: deleted
        ? []
        : data.files
            .filter((f) => message.fileIds.includes(f.id))
            .map((f) => ({
              id: f.id,
              name: f.name,
              size: f.size,
              isImage: Boolean(
                INLINE_TYPES[extname(f.name).toLowerCase()]?.startsWith(
                  "image/",
                ),
              ),
            })),
      mentionIds: message.mentionIds,
      createdAt: message.createdAt,
      editedAt: message.editedAt ?? null,
      deleted,
    };
  }

  function findMentions(text, conversation) {
    const lower = text.toLowerCase();
    return audienceOf(conversation).filter((id) => {
      const name = userById(id)?.name.toLowerCase();
      return Boolean(name) && lower.includes(`@${name}`);
    });
  }

  function removeFiles(predicate) {
    const gone = data.files.filter(predicate);
    for (const file of gone) {
      try {
        unlinkSync(join(filesDir, file.filename));
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
    }
    data.files = data.files.filter((f) => !gone.includes(f));
  }

  function removeConversations(ids) {
    data.conversations = data.conversations.filter((c) => !ids.has(c.id));
    data.messages = data.messages.filter((m) => !ids.has(m.conversationId));
    removeFiles((f) => ids.has(f.conversationId));
  }

  // --- Guards ------------------------------------------------------------------------------
  const notFound = (res, what) =>
    res.status(404).json({ error: `${what} not found` });

  function requireTeam(req, res, next) {
    const team = data.teams.find((t) => t.id === req.params.teamId);
    const membership = team && memberOfTeam(team, req.user.id);
    if (!membership) return notFound(res, "Team");
    req.team = team;
    req.isOwner = membership.role === "owner";
    next();
  }

  function requireOwner(req, res, next) {
    if (!req.isOwner) {
      return res.status(403).json({ error: "Only a team owner can do this" });
    }
    next();
  }

  function requireConversation(req, res, next) {
    const conversation = data.conversations.find(
      (c) => c.id === req.params.conversationId,
    );
    if (!conversation || !canAccess(conversation, req.user.id)) {
      return notFound(res, "Conversation");
    }
    req.conversation = conversation;
    next();
  }

  function requireOwnMessage(req, res, next) {
    const message = data.messages.find(
      (m) =>
        m.id === req.params.messageId &&
        m.conversationId === req.conversation.id,
    );
    if (!message || message.deletedAt) return notFound(res, "Message");
    if (message.authorId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only change your own messages" });
    }
    req.message = message;
    next();
  }

  /** Fixed-window limit per account, so one account can't flood a public server. */
  const windows = new Map();
  function limit(bucket, max, windowMs) {
    return (req, res, next) => {
      const key = `${bucket}:${req.user.id}`;
      const now = Date.now();
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      if (entry.count > max) {
        return res
          .status(429)
          .json({ error: "Too many requests — wait a moment and try again" });
      }
      next();
    };
  }

  const router = express.Router();

  router.get("/overview", (req, res) => {
    const userId = req.user.id;
    const online = onlineIds();
    res.json({
      me: publicPerson(userId),
      teams: data.teams
        .filter((t) => memberOfTeam(t, userId))
        .map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          myRole: memberOfTeam(t, userId).role,
          members: t.members.map((m) => ({
            ...publicPerson(m.userId),
            role: m.role,
            online: online.has(m.userId),
          })),
        })),
      conversations: data.conversations
        .filter((c) => canAccess(c, userId))
        .map((c) => conversationView(c, userId)),
    });
  });

  router.get("/stream", (req, res) => {
    const userId = req.user.id;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      // no-transform + X-Accel-Buffering stop proxies from holding events back.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 3000\n\n");
    const client = { req, res };
    const set = streams.get(userId) ?? new Set();
    const cameOnline = set.size === 0;
    set.add(client);
    streams.set(userId, set);
    if (cameOnline) push(everyoneWhoKnows(userId), { type: "overview" });

    // Keeps IIS/ARR and other proxies from closing an idle connection.
    const heartbeat = setInterval(() => {
      if (isSessionActive(req)) res.write(": ping\n\n");
      else res.end();
    }, 25_000);

    res.on("close", () => {
      clearInterval(heartbeat);
      set.delete(client);
      if (set.size === 0) {
        streams.delete(userId);
        push(everyoneWhoKnows(userId), { type: "overview" });
      }
    });
  });

  // --- Teams -------------------------------------------------------------------------------
  router.post("/teams", limit("create", 30, 60_000), (req, res) => {
    const name = cleanText(req.body?.name, MAX_NAME);
    if (!name) return res.status(400).json({ error: "A team name is required" });
    const now = Date.now();
    const team = {
      id: `team:${randomUUID()}`,
      name,
      description: cleanText(req.body?.description, 500),
      members: [{ userId: req.user.id, role: "owner" }],
      createdAt: now,
    };
    const general = {
      id: `conv:${randomUUID()}`,
      kind: "channel",
      teamId: team.id,
      name: "General",
      isPrivate: false,
      isDefault: true,
      memberIds: [],
      createdBy: req.user.id,
      createdAt: now,
    };
    data.teams.push(team);
    data.conversations.push(general);
    persist();
    push([req.user.id], { type: "overview" });
    res.status(201).json({ id: team.id, generalId: general.id });
  });

  router.delete("/teams/:teamId", requireTeam, requireOwner, (req, res) => {
    const audience = req.team.members.map((m) => m.userId);
    removeConversations(
      new Set(
        data.conversations
          .filter((c) => c.teamId === req.team.id)
          .map((c) => c.id),
      ),
    );
    data.teams = data.teams.filter((t) => t.id !== req.team.id);
    persist();
    push(audience, { type: "overview" });
    res.status(204).end();
  });

  router.post(
    "/teams/:teamId/members",
    requireTeam,
    requireOwner,
    limit("invite", 30, 60_000),
    (req, res) => {
      const user = userByEmail(req.body?.email);
      if (!user) {
        return res.status(400).json({
          error: "No account uses that email. Ask them to register first.",
        });
      }
      if (memberOfTeam(req.team, user.id)) {
        return res.status(409).json({ error: "Already in this team" });
      }
      req.team.members.push({ userId: user.id, role: "member" });
      persist();
      push(
        req.team.members.map((m) => m.userId),
        { type: "overview" },
      );
      res.status(201).json({ userId: user.id });
    },
  );

  // Owners can remove anyone; anyone can remove themselves ("Leave team").
  router.delete("/teams/:teamId/members/:userId", requireTeam, (req, res) => {
    const { userId } = req.params;
    if (!req.isOwner && userId !== req.user.id) {
      return res.status(403).json({ error: "Only a team owner can do this" });
    }
    const target = memberOfTeam(req.team, userId);
    if (!target) return notFound(res, "Member");
    const owners = req.team.members.filter((m) => m.role === "owner");
    if (target.role === "owner" && owners.length === 1) {
      return res.status(400).json({
        error: "A team needs an owner. Delete the team instead.",
      });
    }
    const audience = req.team.members.map((m) => m.userId);
    req.team.members = req.team.members.filter((m) => m.userId !== userId);
    for (const c of data.conversations) {
      if (c.teamId === req.team.id) {
        c.memberIds = c.memberIds.filter((id) => id !== userId);
      }
    }
    persist();
    push(audience, { type: "overview" });
    res.status(204).end();
  });

  router.post(
    "/teams/:teamId/channels",
    requireTeam,
    limit("create", 30, 60_000),
    (req, res) => {
      const name = cleanText(req.body?.name, MAX_NAME);
      if (!name) {
        return res.status(400).json({ error: "A channel name is required" });
      }
      const duplicate = data.conversations.some(
        (c) =>
          c.teamId === req.team.id &&
          c.name.toLowerCase() === name.toLowerCase(),
      );
      // A private channel the caller can't see still blocks the name; the message is the
      // same either way.
      if (duplicate) {
        return res.status(409).json({ error: "That channel name is taken" });
      }
      const isPrivate = req.body?.isPrivate === true;
      const memberIds = isPrivate
        ? [
            ...new Set([
              req.user.id,
              ...idList(req.body?.memberIds).filter((id) =>
                memberOfTeam(req.team, id),
              ),
            ]),
          ]
        : [];
      const channel = {
        id: `conv:${randomUUID()}`,
        kind: "channel",
        teamId: req.team.id,
        name,
        isPrivate,
        isDefault: false,
        memberIds,
        createdBy: req.user.id,
        createdAt: Date.now(),
      };
      data.conversations.push(channel);
      persist();
      push(audienceOf(channel), { type: "overview" });
      res.status(201).json({ id: channel.id });
    },
  );

  // --- Chats (one-to-one and group), by email so accounts can't be listed. ------------------
  router.post("/chats", limit("create", 30, 60_000), (req, res) => {
    const emails = idList(req.body?.emails);
    const people = emails.map(userByEmail);
    const unknown = emails.filter((_, i) => !people[i]);
    if (unknown.length) {
      return res
        .status(400)
        .json({ error: `No account for: ${unknown.join(", ")}` });
    }
    const memberIds = [...new Set([req.user.id, ...people.map((p) => p.id)])];
    if (memberIds.length < 2) {
      return res.status(400).json({ error: "Add at least one other person" });
    }
    if (memberIds.length > MAX_CHAT_MEMBERS) {
      return res
        .status(400)
        .json({ error: `A chat can have ${MAX_CHAT_MEMBERS} people at most` });
    }
    const name = cleanText(req.body?.name, MAX_NAME);
    // One-to-one chats are unique: starting it again reopens the existing one.
    if (memberIds.length === 2) {
      const existing = data.conversations.find(
        (c) =>
          c.kind === "chat" &&
          c.memberIds.length === 2 &&
          memberIds.every((id) => c.memberIds.includes(id)),
      );
      if (existing) return res.json({ id: existing.id });
    }
    const chat = {
      id: `conv:${randomUUID()}`,
      kind: "chat",
      teamId: null,
      name,
      isPrivate: true,
      isDefault: false,
      memberIds,
      createdBy: req.user.id,
      createdAt: Date.now(),
    };
    data.conversations.push(chat);
    persist();
    push(memberIds, { type: "overview" });
    res.status(201).json({ id: chat.id });
  });

  // --- Messages ------------------------------------------------------------------------------
  router.get(
    "/conversations/:conversationId/messages",
    requireConversation,
    (req, res) => {
      const requested = Number(req.query.limit) || 100;
      const count = Math.min(Math.max(requested, 1), 2000);
      const all = data.messages.filter(
        (m) => m.conversationId === req.conversation.id,
      );
      // Posts are paged; a shown post always comes with all of its replies.
      const posts = all.filter((m) => !m.parentId);
      const shown = new Set(posts.slice(-count).map((m) => m.id));
      res.json({
        hasMore: posts.length > count,
        messages: all
          .filter((m) => shown.has(m.parentId ?? m.id))
          .map(messageView),
      });
    },
  );

  router.post(
    "/conversations/:conversationId/messages",
    requireConversation,
    limit("message", 60, 60_000),
    (req, res) => {
      const text = cleanText(req.body?.text, MAX_TEXT);
      // Only files this user uploaded to this conversation and hasn't posted yet.
      const fileIds = idList(req.body?.fileIds)
        .slice(0, MAX_ATTACHMENTS)
        .filter((id) =>
          data.files.some(
            (f) =>
              f.id === id &&
              !f.messageId &&
              f.uploaderId === req.user.id &&
              f.conversationId === req.conversation.id,
          ),
        );
      if (!text && fileIds.length === 0) {
        return res.status(400).json({ error: "Type a message or add a file" });
      }
      let parentId = null;
      if (req.body?.parentId) {
        const parent = data.messages.find(
          (m) =>
            m.id === req.body.parentId &&
            m.conversationId === req.conversation.id &&
            !m.parentId,
        );
        if (!parent) return notFound(res, "Post");
        parentId = parent.id;
      }
      const message = {
        id: `msg:${randomUUID()}`,
        conversationId: req.conversation.id,
        authorId: req.user.id,
        parentId,
        text,
        fileIds,
        mentionIds: findMentions(text, req.conversation),
        createdAt: Date.now(),
      };
      for (const file of data.files) {
        if (fileIds.includes(file.id)) file.messageId = message.id;
      }
      data.messages.push(message);
      persist();
      push(audienceOf(req.conversation), {
        type: "message",
        conversationId: req.conversation.id,
      });
      res.status(201).json(messageView(message));
    },
  );

  router.put(
    "/conversations/:conversationId/messages/:messageId",
    requireConversation,
    requireOwnMessage,
    limit("message", 60, 60_000),
    (req, res) => {
      const text = cleanText(req.body?.text, MAX_TEXT);
      if (!text && req.message.fileIds.length === 0) {
        return res.status(400).json({ error: "A message can't be empty" });
      }
      req.message.text = text;
      req.message.mentionIds = findMentions(text, req.conversation);
      req.message.editedAt = Date.now();
      persist();
      push(audienceOf(req.conversation), {
        type: "message",
        conversationId: req.conversation.id,
      });
      res.json(messageView(req.message));
    },
  );

  // A deleted message stays as a placeholder so its replies keep their thread.
  router.delete(
    "/conversations/:conversationId/messages/:messageId",
    requireConversation,
    requireOwnMessage,
    (req, res) => {
      removeFiles((f) => f.messageId === req.message.id);
      Object.assign(req.message, {
        text: "",
        fileIds: [],
        mentionIds: [],
        deletedAt: Date.now(),
      });
      persist();
      push(audienceOf(req.conversation), {
        type: "message",
        conversationId: req.conversation.id,
      });
      res.status(204).end();
    },
  );

  router.post(
    "/conversations/:conversationId/read",
    requireConversation,
    (req, res) => {
      data.reads[req.user.id] ??= {};
      data.reads[req.user.id][req.conversation.id] = Date.now();
      persist();
      res.status(204).end();
    },
  );

  // --- Files -----------------------------------------------------------------------------------
  const upload = multer({
    storage: multer.diskStorage({
      destination: filesDir,
      filename: (req, file, cb) => cb(null, randomUUID()),
    }),
    limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  });

  router.post(
    "/conversations/:conversationId/files",
    requireConversation,
    limit("upload", 30, 60_000),
    (req, res) => {
      upload.single("file")(req, res, (err) => {
        if (err) {
          const tooBig = err.code === "LIMIT_FILE_SIZE";
          return res
            .status(tooBig ? 413 : 400)
            .json({ error: tooBig ? "Files can be 25 MB at most" : "Upload failed" });
        }
        if (!req.file) return res.status(400).json({ error: "file is required" });
        // multer reads names as latin1; this restores non-English file names.
        const original = Buffer.from(req.file.originalname, "latin1").toString(
          "utf8",
        );
        const record = {
          id: `file:${randomUUID()}`,
          conversationId: req.conversation.id,
          uploaderId: req.user.id,
          messageId: null,
          name: cleanText(original, 200) || "file",
          filename: req.file.filename,
          size: req.file.size,
          createdAt: Date.now(),
        };
        data.files.push(record);
        persist();
        res
          .status(201)
          .json({ id: record.id, name: record.name, size: record.size });
      });
    },
  );

  router.get("/files/:fileId", (req, res) => {
    const file = data.files.find((f) => f.id === req.params.fileId);
    const conversation =
      file && data.conversations.find((c) => c.id === file.conversationId);
    if (!conversation || !canAccess(conversation, req.user.id)) {
      return notFound(res, "File");
    }
    const inlineType = INLINE_TYPES[extname(file.name).toLowerCase()];
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, no-store",
    });
    if (!inlineType) res.attachment(file.name);
    // Set after attachment(), which would otherwise pick a type from the file's name.
    res.set("Content-Type", inlineType ?? "application/octet-stream");
    res.sendFile(
      file.filename,
      { root: filesDir, cacheControl: false },
      (err) => {
        if (err && !res.headersSent) notFound(res, "File");
      },
    );
  });

  return router;
}
