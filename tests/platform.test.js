import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../packages/platform/store.js';
import { RoomService } from '../packages/platform/rooms.js';
import { SessionService } from '../packages/platform/sessions.js';
import { createRegistry, games } from '../packages/games/registry.js';
import { createApp } from '../apps/server/http.js';

test('platform accepts a non-card simultaneous-action game without rule changes', () => {
  const demo = { manifest: { id: 'vote', title: 'Vote', minPlayers: 2, maxPlayers: 8, stateVersion: 1 },
    create: ids => ({ ids, votes: {} }),
    apply: (s, id, c) => ({ ...s, votes: { ...s.votes, [id]: c.vote } }),
    view: (s, id) => ({ voted: Object.keys(s.votes), ownVote: s.votes[id] ?? null }),
    isFinished: s => Object.keys(s.votes).length === s.ids.length };
  const store = new JsonStore();
  const service = new RoomService(store, createRegistry([demo]));
  const sessions = new SessionService(store);
  const a = sessions.create('A').user, b = sessions.create('B').user;
  let r = service.createRoom(a, { gameId: 'vote', title: 'Test' }); r = service.join(b, r.id);
  r = service.mutate(a, r.id, { type: 'ready', ready: true, revision: r.revision });
  r = service.mutate(b, r.id, { type: 'ready', ready: true, revision: r.revision });
  r = service.mutate(a, r.id, { type: 'start', revision: r.revision });
  r = service.mutate(b, r.id, { type: 'game', command: { vote: 7 }, revision: r.revision });
  assert.equal(service.snapshot(r.id, a).game.ownVote, null);
  r = service.mutate(a, r.id, { type: 'game', command: { vote: 2 }, revision: r.revision });
  assert.equal(r.status, 'finished');
});
test('storage commits atomically, rolls back failures, survives restart with identity', () => {
  const dir = mkdtempSync(join(tmpdir(), 'moon-table-'));
  try {
    const file = join(dir, 'data.json'); let store = new JsonStore(file);
    let service = new RoomService(store, games); const session = new SessionService(store).create('A');
    const room = service.createRoom(session.user, { gameId: 'cabo', title: 'Persisted' });
    assert.throws(() => store.transaction(data => { data.rooms = {}; throw new Error('failure'); }));
    assert.ok(store.data.rooms[room.id]);
    store = new JsonStore(file); service = new RoomService(store, games);
    const user = new SessionService(store).authenticate(session.token); assert.equal(service.snapshot(room.id, user).title, 'Persisted');
    assert.ok(!JSON.stringify(store.data).includes(session.token));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('real HTTP: sessions, room permissions, SSE privacy, stale actions, chat, reconnection', async t => {
  const app = createApp({ store: new JsonStore(), registry: games });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { app.closeStreams(); await new Promise(resolve => app.server.close(resolve)); });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function request(path, data, cookie) {
    const res = await fetch(base + '/api' + path, { method: data === undefined ? 'GET' : 'POST',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }
  const a = await request('/session', { name: 'Alice' }); const b = await request('/session', { name: 'Bob' });
  const outsider = await request('/session', { name: 'Mallory' });
  assert.equal((await request('/rooms', { gameId: 'cabo', title: 'No cookie' })).status, 401);
  let r = (await request('/rooms', { gameId: 'cabo', title: 'Test' }, a.cookie)).data;
  r = (await request(`/rooms/${r.id}/join`, {}, b.cookie)).data;
  assert.equal((await request(`/rooms/${r.id}`, undefined, outsider.cookie)).status, 403);
  assert.equal((await request(`/rooms/${r.id}/actions`, { type: 'start', revision: r.revision }, b.cookie)).status, 403);
  async function action(client, input, revision = r.revision) {
    const result = await request(`/rooms/${r.id}/actions`, { ...input, revision }, client.cookie);
    if (result.status === 200) r = result.data; return result;
  }
  const old = r.revision;
  await action(a, { type: 'ready', ready: true });
  assert.equal((await action(b, { type: 'ready', ready: true }, old)).status, 409);
  await action(b, { type: 'ready', ready: true }); await action(a, { type: 'start' });
  assert.equal(r.game.phase, 'setup');
  await action(a, { type: 'game', command: { type: 'look', slots: [0, 1] } });
  const response = await fetch(`${base}/api/rooms/${r.id}/events`, { headers: { Cookie: b.cookie } });
  const reader = response.body.getReader(); let chunk = '';
  while (!chunk.includes('\n\n')) chunk += new TextDecoder().decode((await reader.read()).value);
  const snapshot = JSON.parse(chunk.split('\n').find(line => line.startsWith('data: ')).slice(6));
  assert.ok(snapshot.game.players[0].cards.every(c => c.value === null));
  assert.equal(snapshot.game.deck, undefined); assert.equal(snapshot.game.setup, null);
  await reader.cancel();
  await action(a, { type: 'game', command: { type: 'confirm' } });
  await action(b, { type: 'game', command: { type: 'look', slots: [0, 1] } });
  await action(b, { type: 'game', command: { type: 'confirm' } });
  const actor = r.game.turnId === a.data.id ? a : b;
  const other = actor === a ? b : a;
  await action(actor, { type: 'game', command: { type: 'draw', source: 'deck' } });
  const otherSnapshot = (await request(`/rooms/${r.id}`, undefined, other.cookie)).data;
  assert.equal(otherSnapshot.game.drawn, null);
  assert.equal((await action(other, { type: 'game', command: { type: 'discard' } })).status, 403);
  await action(actor, { type: 'game', command: { type: 'discard' } });
  assert.equal((await request(`/rooms/${r.id}/chat`, { text: '<script>alert(1)</script>' }, a.cookie)).status, 200);
  const refreshed = (await request('/me', undefined, a.cookie)).data;
  assert.equal(refreshed.roomId, r.id);
  assert.equal((await request(`/rooms/${r.id}`, undefined, b.cookie)).data.chat.length, 1);
  const crossSite = await fetch(`${base}/api/session`, { method: 'POST', headers: { Origin: 'http://evil.invalid', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(crossSite.status, 403);
  const home = await fetch(base); assert.equal(home.status, 200); assert.match(await home.text(), /MOON|Moon/);
  const atlas = await fetch(base + '/assets/cabo-atlas-v1.png');
  assert.equal(atlas.status, 200); assert.equal(atlas.headers.get('content-type'), 'image/png');
  assert.ok((await atlas.arrayBuffer()).byteLength > 1000);
  const painting = await fetch(base + '/assets/seven-wonders/wonders-v1.webp');
  assert.equal(painting.status, 200);
  assert.equal(painting.headers.get('content-type'), 'image/webp');
  assert.equal(painting.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const image = Buffer.from(await painting.arrayBuffer());
  assert.equal(image.subarray(0,4).toString(), 'RIFF');
  assert.equal(image.subarray(8,12).toString(), 'WEBP');
  const head = await fetch(base + '/assets/seven-wonders/wonders-v1.webp', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type'), 'image/webp');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal((await fetch(base + '/api/games')).headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(base + '/assets/cabo/reference-style/manifest.json')).status, 404);
});
