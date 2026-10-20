import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {JsonStore, migrateStorage} from '../packages/platform/store.js';
import {ForumService} from '../packages/platform/forum.js';
import {SessionService} from '../packages/platform/sessions.js';
import {createApp} from '../apps/server/http.js';
import {games} from '../packages/games/registry.js';
import {forumPage, topicComposer, topicDetail, topicList} from '../apps/web/forum/views.js';

function fixture() {
  const store = new JsonStore(), sessions = new SessionService(store);
  let now = 100;
  const forum = new ForumService(store, {now: () => now++});
  return {store, forum, a: sessions.create('月见').user, b: sessions.create('观星人').user};
}
const draft = (extra = {}) => ({title: '想玩卡坦岛', body: '一起开拓下一座岛屿。', category: 'game', ...extra});

test('v4 storage migrates to an empty forum, preserves unrelated data and backs up once', () => {
  const f = fixture(), input = structuredClone(f.store.data); input.version = 4; delete input.forum;
  input.rooms.preserve = {stateVersion: 9, revision: 2, game: {secret: ['unchanged']}};
  const original = structuredClone(input), migrated = migrateStorage(input);
  assert.equal(migrated.version, 6); assert.deepEqual(migrated.forum, {nextNumber: 1, topics: {}});
  for (const key of Object.keys(original).filter(k => k !== 'version')) assert.deepEqual(migrated[key], original[key]);
  assert.deepEqual(input, original); assert.deepEqual(migrateStorage(migrated), migrated);
  const base = resolve('work'); mkdirSync(base, {recursive: true});
  const dir = mkdtempSync(join(base, 'forum-migrate-'));
  try {
    const file = join(dir, 'platform.json'), source = JSON.stringify(input); writeFileSync(file, source);
    const store = new JsonStore(file); assert.equal(store.data.version, 6);
    assert.equal(readFileSync(file + '.v4.bak', 'utf8'), source);
    new JsonStore(file); assert.equal(readFileSync(file + '.v4.bak', 'utf8'), source);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('topics and replies retain optional contacts; public projections omit private profile and supporter data', () => {
  const {store, forum, a, b} = fixture();
  const topic = forum.create(a, draft({contact: ' hello@example.test '}));
  assert.equal(topic.number, 1); assert.equal(topic.contact, 'hello@example.test'); assert.equal(topic.owner, true);
  const reply = forum.reply(b, topic.id, {body: '我也想玩！', contact: 'WX: tabletop-test'});
  assert.equal(reply.replies.length, 1); assert.equal(reply.replies[0].contact, 'WX: tabletop-test');
  const plain = forum.create(b, draft({category: 'chat'})); assert.equal(plain.contact, '');
  forum.support(b, topic.id, {supported: true});
  const anon = forum.detail(undefined, topic.id);
  assert.equal(anon.owner, false); assert.equal(anon.supported, false); assert.equal(anon.supportCount, 1);
  assert.equal(forum.list().items[0].body, undefined); assert.equal(forum.list().items[0].contact, undefined);
  const serialized = JSON.stringify(anon);
  for (const field of ['credits', 'friendCode', 'supporters', 'inventory', 'accounts', 'sessions', 'equipped']) assert.equal(serialized.includes('"' + field + '"'), false);
  anon.replies[0].body = 'forged'; anon.author.appearance.avatar = 'forged';
  assert.equal(store.data.forum.topics[topic.id].replies[0].body, '我也想玩！');
  assert.equal(forum.detail(a, topic.id).author.appearance.avatar, 'avatar-traveler');
});

test('invalid posts and replies leave storage untouched', () => {
  const {store, forum, a} = fixture(); const topic = forum.create(a, draft()); const before = structuredClone(store.data);
  for (const extra of [{title: ''}, {title: 'x'.repeat(81)}, {body: ' '}, {body: 'x'.repeat(2001)}, {category: 'fake'}, {contact: 123}, {contact: 'x'.repeat(121)}]) assert.throws(() => forum.create(a, draft(extra)), {status: 400});
  for (const body of ['', ' ', 'x'.repeat(2001), null]) assert.throws(() => forum.reply(a, topic.id, {body}), {status: 400});
  assert.throws(() => forum.reply(a, 'missing', {body: 'hello'}), {status: 404});
  for (const id of ['constructor', 'toString']) {
    assert.throws(() => forum.detail(a, id), {status: 404});
    assert.throws(() => forum.reply(a, id, {body: 'hello'}), {status: 404});
  }
  assert.deepEqual(store.data, before);
});

test('only authors close and reopen at the current revision; closed topics reject replies atomically', () => {
  const {store, forum, a, b} = fixture(); const topic = forum.create(a, draft());
  forum.reply(b, topic.id, {body: '一起！'}); const before = structuredClone(store.data);
  assert.throws(() => forum.status(b, topic.id, {status: 'closed', revision: 1}), {status: 403});
  assert.throws(() => forum.status(a, topic.id, {status: 'closed', revision: 0}), {status: 409});
  assert.deepEqual(store.data, before);
  const closed = forum.status(a, topic.id, {status: 'closed', revision: 1});
  assert.equal(closed.status, 'closed');
  assert.throws(() => forum.reply(b, topic.id, {body: 'late'}), {status: 409});
  const reopened = forum.status(a, topic.id, {status: 'open', revision: closed.revision});
  assert.equal(forum.reply(b, topic.id, {body: '继续聊'}).replies.length, 2);
  assert.equal(reopened.status, 'open');
});

test('support is idempotent per player and can be withdrawn independently', () => {
  const {forum, a, b} = fixture(); const topic = forum.create(a, draft());
  forum.support(a, topic.id, {supported: true}); forum.support(a, topic.id, {supported: true});
  assert.equal(forum.support(b, topic.id, {supported: true}).supportCount, 2);
  assert.equal(forum.support(a, topic.id, {supported: false}).supportCount, 1);
  assert.equal(forum.detail(b, topic.id).supported, true);
  assert.throws(() => forum.support(a, topic.id, {supported: 'yes'}), {status: 400});
});

test('category, state, search, activity, popularity and pagination use persisted discussions', () => {
  const {forum, a, b} = fixture(); const first = forum.create(a, draft());
  for (let i = 0; i < 23; i++) forum.create(a, draft({title: '功能建议 ' + i, category: 'suggestion'}));
  assert.equal(forum.list().items.length, 20); assert.equal(forum.list().pages, 2);
  assert.equal(forum.list(undefined, {page: 2}).items.length, 4);
  assert.equal(forum.list(a, {category: 'game'}).items[0].id, first.id);
  assert.equal(forum.list(a, {q: '卡坦岛'}).total, 1); assert.equal(forum.list(a, {q: '开拓'}).total, 24);
  forum.reply(b, first.id, {body: 'bump'}); assert.equal(forum.list().items[0].id, first.id);
  assert.notEqual(forum.list(a, {sort: 'newest'}).items[0].id, first.id);
  forum.support(b, first.id, {supported: true}); assert.equal(forum.list(a, {sort: 'popular'}).items[0].id, first.id);
  forum.status(a, first.id, {status: 'closed', revision: forum.detail(a, first.id).revision});
  assert.equal(forum.list(a, {status: 'open'}).total, 23); assert.equal(forum.list(a, {status: 'closed'}).total, 1);
  assert.deepEqual(forum.list().counts, {all: 24, open: 23, closed: 1, suggestion: 23, game: 1, chat: 0});
  assert.throws(() => forum.list(a, {page: 'bad'})); assert.throws(() => forum.list(a, {q: 'x'.repeat(101)}));
});

test('forum, replies, contacts and topic numbering survive a store restart', () => {
  const base = resolve('work'); mkdirSync(base, {recursive: true}); const dir = mkdtempSync(join(base, 'forum-save-'));
  try {
    const {store, a, b} = fixture(), file = join(dir, 'platform.json'); writeFileSync(file, JSON.stringify(store.data));
    const disk = new JsonStore(file), forum = new ForumService(disk), topic = forum.create(a, draft({contact: 'example@test.invalid'}));
    forum.reply(b, topic.id, {body: '记得带上我'}); forum.support(b, topic.id, {supported: true});
    const reopened = new ForumService(new JsonStore(file)); assert.deepEqual(reopened.detail(a, topic.id), forum.detail(a, topic.id));
    assert.equal(reopened.create(a, draft()).number, 2);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('forum renders untrusted content as text and shows optional contacts only when present', () => {
  const {forum, a} = fixture(); const unsafe = '<img src=x onerror=evil()>', topic = forum.create(a, draft({title: unsafe, body: unsafe, contact: unsafe}));
  forum.reply(a, topic.id, {body: unsafe, contact: unsafe}); const detail = forum.detail(a, topic.id); detail.author.name = unsafe;
  for (const html of [topicDetail(detail, a), topicList(forum.list(a)), topicComposer(a)]) {
    assert.equal(html.includes('<img src=x'), false); assert.equal(html.includes('<script'), false);
  }
  assert.match(topicDetail(detail, a), /&lt;img/); assert.match(topicComposer(null), /name="name"/);
  assert.equal((topicDetail(forum.create(a, draft()), a).match(/class="forum-contact"/g) ?? []).length, 0);
  assert.match(forumPage(), /玩家论坛/); assert.match(topicComposer(a), /选填/);
});

test('HTTP supports public reading, session-owned posting, independent replies and author-only state changes', async t => {
  const store = new JsonStore(), app = createApp({store, registry: games});
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { app.closeStreams(); await new Promise(resolve => app.server.close(resolve)); });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function request(path, data, cookie) {
    const response = await fetch(base + '/api' + path, {method: data === undefined ? 'GET' : 'POST',
      headers: {...(cookie ? {cookie} : {}), ...(data === undefined ? {} : {'Content-Type': 'application/json'})}, body: data === undefined ? undefined : JSON.stringify(data)});
    return {status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0]};
  }
  assert.equal((await request('/forum')).status, 200); assert.equal((await request('/forum', draft())).status, 401);
  const a = await request('/session', {name: '甲'}), b = await request('/session', {name: '乙'});
  const created = await request('/forum', draft({body: '中文'.repeat(1000), contact: 'test@example.invalid'}), a.cookie);
  assert.equal(created.status, 201); const id = created.data.id;
  assert.equal((await request('/forum/' + id)).data.contact, 'test@example.invalid');
  const replied = await request(`/forum/${id}/replies`, {body: '一起玩'}, b.cookie); assert.equal(replied.status, 201);
  assert.equal((await request(`/forum/${id}/support`, {supported: true}, b.cookie)).data.supportCount, 1);
  const latest = (await request('/forum/' + id, undefined, a.cookie)).data;
  assert.equal((await request(`/forum/${id}/status`, {status: 'closed', revision: latest.revision}, b.cookie)).status, 403);
  assert.equal((await request(`/forum/${id}/status`, {status: 'closed', revision: latest.revision}, a.cookie)).status, 200);
  assert.equal((await request(`/forum/${id}/replies`, {body: 'late'}, b.cookie)).status, 409);
  assert.equal((await request('/forum?status=closed')).data.total, 1); assert.equal((await request('/forum/missing')).status, 404);
  assert.equal((await fetch(base + '/forum/forum.css')).status, 200);
});
