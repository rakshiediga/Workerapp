import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Prisma } from '../dist/generated/prisma/client.js';
const a = { id: randomUUID(), name: 'Customer A', email: 'a@example.com', phone: '0000000031', role: 'CUSTOMER', isActive: true, createdAt: new Date(), passwordHash: 'private' };
const b = { ...a, id: randomUUID(), name: 'Customer B', email: 'b@example.com', phone: '0000000032' };
const worker = { ...a, id: randomUUID(), role: 'WORKER' };
const users = [a, b, worker];
const matches = (user, where) => Object.entries(where).every(([key, value]) => user[key] === value);
const select = (user, fields) => user ? Object.fromEntries(Object.keys(fields).map(key => [key, user[key]])) : null;
let fail = false;
const database = { user: {
  findUnique: async ({where, select: fields}) => select(users.find(user => matches(user, where)), fields),
  findUniqueOrThrow: async ({where, select: fields}) => select(users.find(user => matches(user, where)), fields),
  updateMany: async ({where, data}) => {
    if (fail) throw Error('Private database details');
    const user = users.find(user => matches(user, where));
    if (!user) return {count: 0};
    if (data.email && users.some(other => other.id !== user.id && other.email === data.email)) throw new Prisma.PrismaClientKnownRequestError('Private constraint details', {code: 'P2002', clientVersion: '7.10.0'});
    Object.assign(user, data); return {count: 1};
  },
}};
mock.module('../dist/lib/prisma.js', {namedExports: {getPrismaClient: () => database}});
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const token = user => jwt.sign({userId: user.id, role: user.role}, process.env.JWT_SECRET, {expiresIn: '1h'});
const {default: app} = await import('../dist/app.js');
test('customer profile API using isolated database double', async t => {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async (method = 'GET', body, auth = token(a), path = '/api/profile') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {method, headers: {...(auth ? {Authorization: 'Bearer ' + auth} : {}), ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
    return {status: response.status, body: await response.json()};
  };
  await t.test('requires active CUSTOMER authentication and returns safe identity', async () => {
    for (const method of ['GET', 'PATCH']) {
      assert.equal((await request(method, method === 'PATCH' ? {name: 'Name'} : undefined, null)).status, 401);
      assert.equal((await request(method, undefined, 'invalid')).status, 401);
      assert.equal((await request(method, undefined, token(worker))).status, 403);
    }
    const result = await request(); assert.equal(result.status, 200); assert.equal(result.body.data.user.id, a.id); assert.ok(result.body.data.user.createdAt);
    assert.equal('passwordHash' in result.body.data.user, false); assert.equal('accessToken' in result.body.data.user, false);
    a.isActive = false; assert.equal((await request()).status, 403); a.isActive = true;
  });
  await t.test('validates names, emails and rejects every protected field without mutation', async () => {
    const before = {...a};
    for (const body of [{}, {name: ' '}, {name: 'x'}, {name: 'x'.repeat(101)}, {name: 'Name', email: 'invalid'}, {name: 'Name', email: 42}, ...['phone','role','isActive','id','userId','customerId','createdAt','passwordHash'].map(key => ({name: 'Changed', [key]: 'forbidden'}))]) assert.equal((await request('PATCH', body)).status, 400);
    assert.deepEqual(a, before);
    assert.equal((await request('PATCH', {name: 'Other'}, token(a), '/api/profile/' + b.id)).status, 404);
  });
  await t.test('updates only JWT owner, trims and normalizes, persists through subsequent reads', async () => {
    const beforeB = {...b};
    const updated = await request('PATCH', {name: ' Updated Customer ', email: ' NEW@EXAMPLE.COM '});
    assert.equal(updated.status, 200); assert.equal(updated.body.data.user.name, 'Updated Customer'); assert.equal(updated.body.data.user.email, 'new@example.com'); assert.deepEqual(b, beforeB);
    assert.equal((await request()).body.data.user.name, 'Updated Customer');
    assert.equal((await request('GET', undefined, token(a), '/api/auth/me')).body.data.user.email, 'new@example.com');
    assert.equal((await request('PATCH', {name: a.name, email: a.email})).status, 200);
  });
  await t.test('duplicate email safely returns 409 and optional email clears to null', async () => {
    const before = {...b}; const result = await request('PATCH', {name: 'Customer B', email: a.email}, token(b));
    assert.equal(result.status, 409); assert.equal(result.body.message, 'Email is already in use'); assert.deepEqual(b, before);
    assert.equal((await request('PATCH', {name: a.name, email: '   '})).body.data.user.email, null);
    assert.equal((await request('PATCH', {name: a.name})).body.data.user.email, null);
    fail = true; const failure = await request('PATCH', {name: 'Name'}); fail = false;
    assert.equal(failure.status, 500); assert.equal(JSON.stringify(failure.body).includes('Private'), false);
  });
});
