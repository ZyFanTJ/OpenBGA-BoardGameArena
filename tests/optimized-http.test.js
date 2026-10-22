import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../packages/platform/sqlite-store.js';
import { games } from '../packages/games/registry.js';
import { createApp } from '../apps/server/http.js';

async function fixture(t, options = {}) {
  const store = new SqliteStore(), app = createApp({ store, registry: games, ...options });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { app.closeStreams(); await new Promise(resolve => app.server.close(resolve)); store.close(); });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function request(path, data, cookie, headers = {}) {
    const response = await fetch(`${base}/api${path}`, { method: data === undefined ? 'GET' : 'POST',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  return { store, app, base, request };
}

test('HTTP players behind one proxy have independent write budgets; rotating forwarded addresses cannot bypass a player limit', async t => {
  const f = await fixture(t, { trustedProxyHops: 1 });
  const a = await f.request('/session', { name: '甲' }), b = await f.request('/session', { name: '乙' });
  for (let i = 0; i < 240; i++) {
    const result = await f.request('/rooms/AAAAAAAA/actions', {}, a.cookie, { 'X-Forwarded-For': `198.51.100.${i % 200 + 1}` });
    assert.equal(result.status, 404);
  }
  assert.equal((await f.request('/rooms/AAAAAAAA/actions', {}, a.cookie)).status, 429);
  assert.equal((await f.request('/rooms/AAAAAAAA/actions', {}, b.cookie)).status, 404);
  for (let i = 0; i < 15; i++) assert.equal((await f.request('/auth/login', { handle: 'AccountA', password: 'short' })).status, 400);
  assert.equal((await f.request('/auth/login', { handle: 'accounta', password: 'short' })).status, 429);
  assert.equal((await f.request('/auth/login', { handle: 'AccountB', password: 'short' })).status, 400);
});

test('all registered games start through SQLite-backed HTTP without changing private-view or chat contracts', async t => {
  const f = await fixture(t);
  for (const manifest of games.list()) {
    const clients = [];
    for (let i = 0; i < manifest.minPlayers; i++) clients.push(await f.request('/session', { name: `${manifest.id}-${i}` }));
    let room = (await f.request('/rooms', { gameId: manifest.id, title: '兼容测试', turnSeconds: 0 }, clients[0].cookie)).data;
    for (const client of clients.slice(1)) room = (await f.request(`/rooms/${room.id}/join`, { revision: room.revision }, client.cookie)).data;
    for (const client of clients) room = (await f.request(`/rooms/${room.id}/actions`, { type: 'ready', ready: true, revision: room.revision }, client.cookie)).data;
    const started = await f.request(`/rooms/${room.id}/actions`, { type: 'start', revision: room.revision }, clients[0].cookie);
    assert.equal(started.status, 200, manifest.id); room = started.data;
    assert.equal(room.status, 'playing'); assert.ok(room.game);
    assert.equal((await f.request(`/rooms/${room.id}/chat`, { text: '真实接口聊天' }, clients[0].cookie)).status, 200);
    const refreshed = (await f.request(`/rooms/${room.id}`, undefined, clients[0].cookie)).data;
    assert.equal(refreshed.revision, room.revision); assert.equal(refreshed.chat.at(-1).text, '真实接口聊天');
    assert.equal((await f.request(`/rooms/${room.id}`, undefined, 'moon_session=' + 'a'.repeat(64))).status, 401);
  }
});

test('v2 HTTP event stream delivers chat as a small update with no game payload and reconnect returns a full private view', async t => {
  const f = await fixture(t), user = await f.request('/session', { name: '同步玩家' });
  const room = (await f.request('/rooms', { gameId: 'cabo', title: '增量同步' }, user.cookie)).data;
  async function stream() {
    const response = await fetch(`${f.base}/api/rooms/${room.id}/events?protocol=2`, { headers: { Cookie: user.cookie } });
    const reader = response.body.getReader(); let buffer = '';
    return { close: () => reader.cancel(), async next() {
      while (!buffer.includes('\n\n')) buffer += new TextDecoder().decode((await reader.read()).value);
      const end = buffer.indexOf('\n\n'), frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      return JSON.parse(frame.split('\n').find(line => line.startsWith('data: ')).slice(6));
    } };
  }
  let channel = await stream(); assert.equal((await channel.next()).id, room.id);
  await f.request(`/rooms/${room.id}/chat`, { text: '只发送一条消息' }, user.cookie);
  const event = await channel.next(); assert.equal(event.type, 'chat'); assert.equal(event.game, undefined); assert.equal(event.chat, undefined);
  await channel.close(); channel = await stream(); const recovered = await channel.next();
  assert.equal(recovered.chat.at(-1).text, '只发送一条消息'); assert.equal(recovered.type, undefined); await channel.close();
});
