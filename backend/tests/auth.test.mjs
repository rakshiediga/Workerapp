import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma } from "../dist/generated/prisma/client.js";

// Isolated test double: these tests do NOT verify real PostgreSQL persistence.
const users = [];
let databaseAvailable = true;
let concurrentDuplicate = false;
const select = (user, fields) => user ? Object.fromEntries(Object.entries(fields).filter(([, enabled]) => enabled).map(([key]) => [key, user[key]])) : null;
const database = { user: {
  async findUnique({ where, select: fields }) {
    const user = users.find((entry) => Object.entries(where).every(([key, value]) => entry[key] === value));
    return select(user, fields);
  },
  async create({ data, select: fields }) {
    if (concurrentDuplicate) throw new Prisma.PrismaClientKnownRequestError("Test unique conflict", { code: "P2002", clientVersion: "7.10.0" });
    const user = { id: randomUUID(), ...data };
    users.push(user);
    return select(user, fields);
  },
} };
mock.module("../dist/lib/prisma.js", { namedExports: { getPrismaClient: () => databaseAvailable ? database : null } });
process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.JWT_EXPIRES_IN = "7d";
const { default: app } = await import("../dist/app.js");
const { validateRegistration, validateLogin } = await import("../dist/services/auth.service.js");

test("authentication security and HTTP behavior with an isolated database double", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const example = { name: "Rahul Kumar", phone: "9876543210", email: "rahul@example.com", password: "StrongPassword123" };
  const request = async (path, body, token) => {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  let token;

  await t.test("explicit validation, phone/email normalization and bcrypt byte limit", () => {
    for (const body of [null, [], {}, { ...example, name: " " }, { ...example, phone: "123" }, { ...example, password: "short" }, { ...example, email: "bad" }, { ...example, password: "é".repeat(37) }]) assert.throws(() => validateRegistration(body));
    const input = validateRegistration({ ...example, name: " Rahul Kumar ", phone: "98765 43210", email: " RAHUL@EXAMPLE.COM " });
    assert.equal(input.phone, example.phone);
    assert.equal(input.email, example.email);
    assert.equal(validateRegistration({ ...example, email: undefined }).email, undefined);
    assert.throws(() => validateLogin({ phone: example.phone, password: 123 }));
  });

  await t.test("registration forces CUSTOMER, hashes at cost 12, returns safe user/token", async () => {
    const result = await request("/api/auth/register/customer", { ...example, role: "ADMIN" });
    assert.equal(result.status, 201);
    assert.equal(result.body.data.user.role, "CUSTOMER");
    assert.equal(result.body.data.user.isActive, true);
    assert.equal("passwordHash" in result.body.data.user, false);
    assert.equal(users[0].passwordHash === example.password, false);
    assert.equal(bcrypt.getRounds(users[0].passwordHash), 12);
    assert.equal(await bcrypt.compare(example.password, users[0].passwordHash), true);
    token = result.body.data.accessToken;
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    assert.deepEqual(Object.keys(payload).sort(), ["exp", "iat", "role", "userId"]);
    assert.equal(payload.exp - payload.iat, 7 * 86400);
  });

  await t.test("duplicate phone/email and concurrent uniqueness conflicts return 409", async () => {
    assert.equal((await request("/api/auth/register/customer", example)).status, 409);
    assert.equal((await request("/api/auth/register/customer", { ...example, phone: "9876543211", email: "RAHUL@EXAMPLE.COM" })).status, 409);
    concurrentDuplicate = true;
    const result = await request("/api/auth/register/customer", { ...example, phone: "9876543212", email: undefined });
    concurrentDuplicate = false;
    assert.equal(result.status, 409);
    assert.equal(users.length, 1);
  });

  await t.test("login works; wrong, absent and inactive credentials share a generic error", async () => {
    const correct = await request("/api/auth/login", { phone: example.phone, password: example.password });
    assert.equal(correct.status, 200);
    assert.equal(typeof correct.body.data.accessToken, "string");
    assert.equal("passwordHash" in correct.body.data.user, false);
    const wrong = await request("/api/auth/login", { phone: example.phone, password: "WrongPassword123" });
    const absent = await request("/api/auth/login", { phone: "0000000000", password: example.password });
    users[0].isActive = false;
    const inactive = await request("/api/auth/login", { phone: example.phone, password: example.password });
    users[0].isActive = true;
    for (const result of [wrong, absent, inactive]) {
      assert.equal(result.status, 401);
      assert.deepEqual(result.body, { success: false, message: "Invalid phone number or password" });
    }
  });

  await t.test("me, missing/invalid/expired tokens and role authorization", async () => {
    const me = await request("/api/auth/me", undefined, token);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.id, users[0].id);
    assert.equal("passwordHash" in me.body.data.user, false);
    assert.equal((await request("/api/auth/me")).status, 401);
    assert.equal((await request("/api/auth/me", undefined, "invalid-token")).status, 401);
    const payload = { userId: users[0].id, role: "CUSTOMER" };
    const expired = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: -1 });
    const wrongAlgorithm = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: "HS384", expiresIn: "1h" });
    const noExpiry = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: "HS256" });
    for (const bad of [expired, wrongAlgorithm, noExpiry]) assert.equal((await request("/api/auth/me", undefined, bad)).status, 401);
    assert.equal((await request("/api/customer/test", undefined, token)).status, 200);
    users[0].role = "WORKER";
    assert.equal((await request("/api/customer/test", undefined, token)).status, 403);
    users[0].role = "ADMIN";
    assert.equal((await request("/api/customer/test", undefined, token)).status, 403);
    users[0].role = "CUSTOMER";
    users[0].isActive = false;
    assert.equal((await request("/api/auth/me", undefined, token)).status, 403);
    users[0].isActive = true;
  });

  await t.test("safe input/config/database errors and foundation endpoints", async () => {
    assert.equal((await request("/api/auth/register/customer", {})).status, 400);
    const response = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { success: false, message: "Invalid JSON request body." });
    const secret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    assert.equal((await request("/api/auth/login", { phone: example.phone, password: example.password })).status, 503);
    process.env.JWT_SECRET = secret;
    databaseAvailable = false;
    assert.equal((await request("/api/auth/login", { phone: example.phone, password: example.password })).status, 503);
    databaseAvailable = true;
    assert.deepEqual((await request("/")).body, { success: true, message: "Worker Booking API" });
    assert.equal((await request("/unknown")).status, 404);
    assert.equal((await request("/api/auth/register/worker", example)).status, 400);
    assert.equal((await request("/api/auth/register/admin", example)).status, 404);
  });

  await t.test("login rate limiting returns consistent JSON 429", async () => {
    let result;
    for (let attempt = 0; attempt < 31; attempt++) {
      result = await request("/api/auth/login", {});
      if (result.status === 429) break;
    }
    assert.equal(result.status, 429);
    assert.equal(result.body.success, false);
  });
});
