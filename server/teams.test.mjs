// Run with: node --test server/teams.test.mjs
// Uses a temporary data folder, so real data is never touched.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTeamsRouter } from "./teams.mjs";

const users = ["asha", "ben", "carl"].map((name) => ({
  id: `user:${name}`,
  email: `${name}@example.com`,
  name: name[0].toUpperCase() + name.slice(1),
}));
const dataDir = mkdtempSync(join(tmpdir(), "teams-test-"));
let server;
let base;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = users.find((u) => u.id === `user:${req.headers["x-user"]}`);
    next();
  });
  app.use(
    createTeamsRouter({
      dataDir,
      listUsers: () => users,
      isSessionActive: () => true,
    }),
  );
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
  rmSync(dataDir, { recursive: true, force: true });
});

async function call(user, method, path, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(base + path, {
    method,
    headers: {
      "x-user": user,
      ...(body && !isForm ? { "content-type": "application/json" } : {}),
    },
    body: body && !isForm ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  const isJson = res.headers.get("content-type")?.includes("json");
  return {
    status: res.status,
    headers: res.headers,
    body: isJson && text ? JSON.parse(text) : text,
  };
}

let teamId;
let generalId;
const messagesPath = (id) => `/conversations/${id}/messages`;

test("only members see a team; only owners add people", async () => {
  const created = await call("asha", "POST", "/teams", { name: "Design" });
  assert.equal(created.status, 201);
  ({ id: teamId, generalId } = created.body);

  assert.equal((await call("ben", "GET", "/overview")).body.teams.length, 0);
  assert.equal((await call("ben", "GET", messagesPath(generalId))).status, 404);

  const added = await call("asha", "POST", `/teams/${teamId}/members`, {
    email: "BEN@example.com",
  });
  assert.equal(added.status, 201);
  assert.equal(added.body.userId, "user:ben");
  assert.equal((await call("ben", "GET", "/overview")).body.teams.length, 1);

  const notOwner = await call("ben", "POST", `/teams/${teamId}/members`, {
    email: "carl@example.com",
  });
  assert.equal(notOwner.status, 403);
  assert.equal((await call("carl", "DELETE", `/teams/${teamId}`)).status, 404);
});

test("private channels are hidden from other team members", async () => {
  const channel = await call("asha", "POST", `/teams/${teamId}/channels`, {
    name: "secret",
    isPrivate: true,
  });
  const seen = (await call("ben", "GET", "/overview")).body.conversations;
  assert.ok(!seen.some((c) => c.id === channel.body.id));
  const read = await call("ben", "GET", messagesPath(channel.body.id));
  assert.equal(read.status, 404);
  const write = await call("ben", "POST", messagesPath(channel.body.id), {
    text: "hi",
  });
  assert.equal(write.status, 404);
});

test("replies, mentions, unread, and editing only your own message", async () => {
  const post = await call("asha", "POST", messagesPath(generalId), {
    text: "Hello @Ben",
  });
  assert.deepEqual(post.body.mentionIds, ["user:ben"]);

  const general = async () =>
    (await call("ben", "GET", "/overview")).body.conversations.find(
      (c) => c.id === generalId,
    );
  assert.equal((await general()).unread, 1);
  assert.equal((await general()).mentions, 1);
  await call("ben", "POST", `/conversations/${generalId}/read`);
  assert.equal((await general()).unread, 0);

  const reply = await call("ben", "POST", messagesPath(generalId), {
    text: "Hi",
    parentId: post.body.id,
  });
  assert.equal(reply.status, 201);
  const messagePath = `${messagesPath(generalId)}/${post.body.id}`;
  assert.equal(
    (await call("ben", "PUT", messagePath, { text: "x" })).status,
    403,
  );
  assert.equal((await call("ben", "DELETE", messagePath)).status, 403);
  assert.equal((await call("asha", "DELETE", messagePath)).status, 204);
  const list = (await call("ben", "GET", messagesPath(generalId))).body.messages;
  assert.equal(list.length, 2);
  assert.equal(list[0].deleted, true);
  assert.equal(list[0].text, "");
});

test("uploaded HTML is downloaded, never shown, and only to members", async () => {
  const form = new FormData();
  form.append("file", new Blob(["<script>1</script>"]), "page.html");
  const uploaded = await call(
    "asha",
    "POST",
    `/conversations/${generalId}/files`,
    form,
  );
  assert.equal(uploaded.status, 201);

  // Someone else can't attach another person's upload to their own message.
  const stolen = await call("ben", "POST", messagesPath(generalId), {
    text: "t",
    fileIds: [uploaded.body.id],
  });
  assert.deepEqual(stolen.body.files, []);

  const file = await call("ben", "GET", `/files/${uploaded.body.id}`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("content-type"), "application/octet-stream");
  assert.match(file.headers.get("content-disposition"), /^attachment/);
  assert.equal(file.headers.get("x-content-type-options"), "nosniff");
  assert.equal(
    (await call("carl", "GET", `/files/${uploaded.body.id}`)).status,
    404,
  );
});

test("one-to-one chats are reused; outsiders are shut out", async () => {
  const first = await call("asha", "POST", "/chats", {
    emails: ["carl@example.com"],
  });
  const again = await call("carl", "POST", "/chats", {
    emails: ["asha@example.com"],
  });
  assert.equal(again.body.id, first.body.id);
  assert.equal(
    (await call("ben", "GET", messagesPath(first.body.id))).status,
    404,
  );
});

test("a removed member loses access; the last owner can't leave", async () => {
  const lastOwner = await call(
    "asha",
    "DELETE",
    `/teams/${teamId}/members/user:asha`,
  );
  assert.equal(lastOwner.status, 400);
  const leave = await call("ben", "DELETE", `/teams/${teamId}/members/user:ben`);
  assert.equal(leave.status, 204);
  assert.equal((await call("ben", "GET", messagesPath(generalId))).status, 404);
});

test("live stream tells members about a new message", async () => {
  const abort = new AbortController();
  const res = await fetch(`${base}/stream`, {
    headers: { "x-user": "asha" },
    signal: abort.signal,
  });
  const reader = res.body.getReader();
  await call("asha", "POST", messagesPath(generalId), { text: "ping" });
  let seen = "";
  while (!seen.includes('"type":"message"')) {
    const { value, done } = await reader.read();
    assert.ok(!done);
    seen += new TextDecoder().decode(value);
  }
  abort.abort();
});
