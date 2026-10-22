import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/server/http.js';
import { games } from '../packages/games/registry.js';
import { JsonStore } from '../packages/platform/store.js';

test('DND HTTP/SSE: private backgrounds, authenticated commands, stale revisions, DM recovery and finished records', async t => {
  let store = new JsonStore(), app, base, release, progress, calls = 0;
  const provider = async (input, context) => { calls++; progress = context.onProgress; assert.ok(!JSON.stringify(input).includes('PRIVATE-')); return new Promise(resolve => { release = () => resolve({ source: 'ai', value: { narration: '雾灯在风中摇晃，你们的冒险已经开始。' } }); }); };
  async function start(providers = {}) { app = createApp({ store, registry: games, random: () => .8, effectProviders: providers }); await new Promise(r => app.server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${app.server.address().port}`; }
  async function stop() { app.closeStreams(); await new Promise(r => app.server.close(r)); }
  await start({ 'text-json': provider }); t.after(stop);
  async function request(path, data, cookie) {
    const r = await fetch(base + '/api' + path, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  const a = await request('/session', { name: 'Alice' }), b = await request('/session', { name: 'Bob' }), outsider = await request('/session', { name: 'Outside' });
  let room = (await request('/rooms', { gameId: 'dnd', title: 'Adventure' }, a.cookie)).data;
  assert.equal(room.turnSeconds, 0);
  room = (await request(`/rooms/${room.id}/join`, {}, b.cookie)).data;
  async function action(client, body) {
    const r = await request(`/rooms/${room.id}/actions`, { revision: room.revision, ...body }, client.cookie);
    assert.equal(r.status, 200, r.data.error); room = r.data; return room;
  }
  for (const client of [a, b]) await action(client, { type: 'ready', ready: true });
  await action(a, { type: 'start' });
  await action(a, { type: 'game', command: { type: 'character', name: 'A', archetype: 'wizard', note: 'PRIVATE-A' } });
  const before = room.revision;
  await action(b, { type: 'game', command: { type: 'character', name: 'B', archetype: 'cleric', note: 'PRIVATE-B' } });
  assert.ok(room.game.pending); assert.ok(!JSON.stringify(room).includes('PRIVATE-A'));
  assert.equal((await request(`/rooms/${room.id}`, undefined, outsider.cookie)).status, 403);
  assert.equal((await request(`/rooms/${room.id}/actions`, { type: 'game', revision: before, command: { type: 'act', text: 'talk' } }, a.cookie)).status, 409);
  const stream = await fetch(`${base}/api/rooms/${room.id}/events`, { headers: { Cookie: a.cookie } }), reader = stream.body.getReader();
  let buffer = '';
  async function event() {
    while (!buffer.includes('\n\n')) buffer += new TextDecoder().decode((await reader.read()).value);
    const n = buffer.indexOf('\n\n'), part = buffer.slice(0, n); buffer = buffer.slice(n + 2);
    return JSON.parse(part.split('\n').find(line => line.startsWith('data: ')).slice(6));
  }
  const initial = await event(); assert.match(initial.game.ownNote, /PRIVATE-A/); assert.ok(!JSON.stringify(initial).includes('PRIVATE-B'));
  assert.equal(calls, 1);
  const persistedBeforeStream = JSON.stringify(store.data);
  progress({ field: 'narration', text: '雾灯在风中', secret: 'PRIVATE-PROGRESS' });
  const partial = await event();
  assert.equal(partial.revision, initial.revision);
  assert.ok(partial.presentationRevision > initial.presentationRevision);
  assert.equal(partial.game.narrationStream.text, '雾灯在风中');
  assert.ok(!JSON.stringify(partial).includes('PRIVATE-PROGRESS'));
  assert.equal(JSON.stringify(store.data), persistedBeforeStream);
  const reconnect = (await request(`/rooms/${room.id}`, undefined, b.cookie)).data;
  assert.equal(reconnect.game.narrationStream.text, '雾灯在风中');
  release(); room = await event();
  assert.equal(room.game.pending, null); assert.equal(room.game.dmStatus, 'ai'); assert.ok(!JSON.stringify(room).includes('system'));
  assert.equal(room.game.narrationStream, null);
  await reader.cancel();
  const forged = await request(`/rooms/${room.id}/actions`, { revision: room.revision, type: 'completeEffect', result: { won: true } }, a.cookie);
  assert.equal(forged.status, 400);
  await action(a, { type: 'game', command: { type: 'choose', choiceId: 'investigate' } });
  assert.ok(room.game.pendingCheck);
  const pendingRevision = room.revision, pendingId = room.game.pendingCheck.id;
  const restored = (await request(`/rooms/${room.id}`, undefined, a.cookie)).data;
  assert.equal(restored.game.pendingCheck.id, pendingId); assert.equal(restored.game.step, 0);
  await action(a, { type: 'game', command: { type: 'roll' } });
  assert.equal(room.game.lastCheck.id, pendingId);
  const duplicate = await request(`/rooms/${room.id}/actions`, { revision: pendingRevision, type: 'game', command: { type: 'roll' } }, a.cookie);
  assert.equal(duplicate.status, 409);
  assert.ok(room.game.pending);
  const persisted = JSON.stringify(store.data); await stop();
  store = new JsonStore(); store.transaction(data => Object.assign(data, JSON.parse(persisted))); await start();
  room = (await request(`/rooms/${room.id}`, undefined, b.cookie)).data;
  assert.equal(room.game.pending, null); assert.equal(room.game.step, 1); assert.equal(room.game.dmStatus, 'local');
  for (const choiceId of ['talk', 'travel', 'waterway', 'talk', 'study', 'ritual']) {
    const client = room.game.actorId === a.data.id ? a : b;
    await action(client, { type: 'game', command: { type: 'choose', choiceId } });
    if (room.game.pendingCheck) await action(client, { type: 'game', command: { type: 'roll' } });
  }
  assert.equal(room.status, 'finished'); assert.equal(room.game.outcome.won, true);
  const history = (await request('/history', undefined, a.cookie)).data;
  assert.equal(history.items.length, 1); assert.equal(history.items[0].participants.every(p => p.won), true);
  for (const path of ['/games/dnd/index.js', '/games/dnd/style.css', '/games/dnd/roll-ui.js', '/games/dnd/world-ui.js', '/games/dnd/immersion.css', '/games/dnd/play-ui.js', '/games/dnd/play.css', '/games/dnd/scene-ui.js', '/games/dnd/narration-ui.js']) assert.equal((await fetch(base + path)).status, 200);
  assert.equal((await fetch(base + '/packages/games/dnd/content.js')).status, 404);
});
