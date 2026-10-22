import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/server/http.js';
import { JsonStore } from '../packages/platform/store.js';
import { games } from '../packages/games/registry.js';

test('Ninja HTTP/SSE isolates hands, rejects stale revisions, restores choices and serves all art', async t => {
  let store = new JsonStore(), app, base;
  let seed = 55; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  async function start() { app = createApp({ store, registry: games, random }); await new Promise(r => app.server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${app.server.address().port}`; }
  async function close() { app.closeStreams(); await new Promise(r => app.server.close(r)); }
  await start(); t.after(close);
  async function request(path, data, cookie) {
    const response = await fetch(base + '/api' + path, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const catalog = (await request('/games')).data.find(g => g.id === 'night-of-the-ninja');
  assert.equal(catalog.minPlayers, 4); assert.equal(catalog.maxPlayers, 11); assert.equal(catalog.stateVersion, 1);
  const clients = [];
  for (const name of ['A', 'B', 'C', 'D']) clients.push(await request('/session', { name }));
  let room = (await request('/rooms', { gameId: catalog.id, title: 'Ninja integration', turnSeconds: 0 }, clients[0].cookie)).data;
  for (const c of clients.slice(1)) room = (await request(`/rooms/${room.id}/join`, {}, c.cookie)).data;
  const mutate = async (c, action) => {
    const response = await request(`/rooms/${room.id}/actions`, { ...action, revision: room.revision }, c.cookie);
    assert.equal(response.status, 200, response.data.error); room = response.data; return room;
  };
  for (const c of clients) await mutate(c, { type: 'ready', ready: true });
  await mutate(clients[0], { type: 'start' });
  const a = clients[0], b = clients[1], revision = room.revision;
  const response = await fetch(`${base}/api/rooms/${room.id}/events`, { headers: { Cookie: b.cookie } }), reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '';
  async function event() {
    while (!buffer.includes('\n\n')) { const { value, done } = await reader.read(); assert.equal(done, false); buffer += decoder.decode(value); }
    const n = buffer.indexOf('\n\n'), part = buffer.slice(0, n); buffer = buffer.slice(n + 2);
    return JSON.parse(part.split('\n').find(line => line.startsWith('data: ')).slice(6));
  }
  await event();
  const chosen = room.game.pack[0].id;
  await mutate(a, { type: 'game', command: { type: 'draft', cardId: chosen } });
  const push = await event(); assert.equal(push.revision, room.revision); assert.equal(push.game.selected, null);
  assert.ok(push.game.players.filter(p => p.id !== b.data.id).every(p => p.hand.every(c => c === null)));
  assert.notDeepEqual(push.game.pack, room.game.pack); assert.equal(push.game.intel.length, 1);
  const stale = await request(`/rooms/${room.id}/actions`, { revision, type: 'game', command: { type: 'draft', cardId: chosen } }, a.cookie);
  assert.equal(stale.status, 409); assert.equal(store.data.rooms[room.id].revision, room.revision);
  await reader.cancel();
  const saved = JSON.stringify(store.data), expected = structuredClone(room.game); await close();
  store = new JsonStore(); store.transaction(data => Object.assign(data, JSON.parse(saved))); await start();
  room = (await request(`/rooms/${room.id}`, undefined, a.cookie)).data;
  assert.deepEqual(room.game, expected); assert.equal((await request('/me', undefined, a.cookie)).data.roomId, room.id);
  const game = games.get(catalog.id);
  for (let step = 0; step < 200 && !['roundEnd', 'finished'].includes(room.game.phase); step++) {
    const state = store.data.rooms[room.id].game, id = game.turn(state).players[0], client = clients.find(c => c.data.id === id);
    const privateRoom = (await request(`/rooms/${room.id}`, undefined, client.cookie)).data;
    await mutate(client, { type: 'game', command: game.timeout(privateRoom.game, id) });
  }
  assert.ok(['roundEnd', 'finished'].includes(room.game.phase));
  for (const path of ['/games/night-of-the-ninja/index.js', '/games/night-of-the-ninja/art.js', '/games/night-of-the-ninja/style.css', '/assets/night-of-the-ninja/atlas-v1.webp', '/assets/night-of-the-ninja/extra-v1.webp', '/assets/night-of-the-ninja/cover-v1.webp']) {
    const asset = await fetch(base + path); assert.equal(asset.status, 200, path); assert.ok(Number(asset.headers.get('content-length')) > 0);
  }
});
