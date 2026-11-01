import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { JsonStore } from '../packages/platform/store.js';
import { RoomService } from '../packages/platform/rooms.js';
import { BotRunner } from '../packages/platform/bots.js';
import { games, createRegistry } from '../packages/games/registry.js';
import { cabo } from '../packages/games/cabo/index.js';
import { createApp } from '../apps/server/http.js';

const host = { id: 'human', name: 'Human' }, guest = { id: 'guest', name: 'Guest' };
function fixture() {
  const store = new JsonStore(), rooms = new RoomService(store, games, { random: () => 0.5 });
  const id = rooms.createRoom(host, { gameId: 'cabo', title: 'Practice' }).id;
  const act = (input, user = host) => rooms.mutate(user, id, { revision: store.data.rooms[id].revision, ...input });
  return { store, rooms, id, act };
}
async function until(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) { assert.ok(Date.now() < deadline, 'timed out waiting for AI'); await sleep(5); }
}

test('AI seats enforce host, capacity, revision and lobby boundaries; no bot sessions', () => {
  const { store, rooms, id, act } = fixture();
  rooms.join(guest, id);
  assert.throws(() => act({ type: 'addBot' }, guest), { status: 403 });
  let r = act({ type: 'addBot' });
  const bot = r.players.find(p => p.isBot);
  assert.equal(bot.ready, true);
  assert.equal(Object.keys(store.data.sessions).length, 0);
  const stale = r.revision;
  r = act({ type: 'addBot' });
  assert.throws(() => act({ type: 'addBot' }), /房间已满/);
  assert.throws(() => act({ type: 'removeBot', playerId: bot.id, revision: stale }), { status: 409 });
  assert.throws(() => act({ type: 'removeBot', playerId: host.id }), /不是 AI/);
  assert.throws(() => act({ type: 'removeBot', playerId: bot.id }, guest), { status: 403 });
  r = act({ type: 'removeBot', playerId: bot.id });
  assert.equal(r.players.length, 3);
  act({ type: 'ready', ready: true }); act({ type: 'ready', ready: true }, guest);
  act({ type: 'start' });
  assert.throws(() => act({ type: 'addBot' }), { status: 403 });
  assert.throws(() => act({ type: 'removeBot', playerId: r.players.find(p => p.isBot).id }), { status: 403 });
  // Finished fixtures exercise platform rematch without altering the game's persisted shape.
  store.transaction(data => { data.rooms[id].status = 'finished'; });
  r = act({ type: 'rematch' });
  assert.ok(r.players.every(p => p.ready === !!p.isBot));
});

test('host transfers to a human and final human departure removes AI-only room', () => {
  const { store, rooms, id, act } = fixture();
  act({ type: 'addBot' }); rooms.join(guest, id);
  act({ type: 'leave' });
  assert.equal(store.data.rooms[id].hostId, guest.id);
  act({ type: 'leave' }, guest);
  assert.equal(store.data.rooms[id], undefined);
});

test('difficulty is validated and persisted per seat with a backwards-compatible easy default', () => {
  const { rooms, id, act } = fixture();
  assert.throws(()=>act({type:'addBot',difficulty:'omniscient'}),/难度无效/);
  act({type:'addBot'});act({type:'addBot',difficulty:'smart'});
  const r=act({type:'addBot',difficulty:'ruthless'});
  assert.deepEqual(r.players.filter(p=>p.isBot).map(p=>p.botDifficulty),['easy','smart','ruthless']);
  assert.deepEqual(rooms.snapshot(id,host).botDifficulties.map(d=>d.id),['easy','smart','ruthless']);
});

test('games without an AI strategy keep human-only rooms', () => {
  const { bot, ...humanOnly } = cabo;
  const rooms = new RoomService(new JsonStore(), createRegistry([humanOnly]));
  const r = rooms.createRoom(host, { gameId: 'cabo', title: 'Human only' });
  assert.equal(r.supportsBots, false);
  assert.throws(() => rooms.mutate(host, r.id, { type: 'addBot', revision: r.revision }), /不支持 AI/);
});

test('CABO AI completes standard and expert rounds using only redacted views', () => {
  for (const expert of [false, true]) for (const count of [2, 4]) {
    let seed = 23456;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const ids = Array.from({ length: count }, (_, i) => `bot-${i}`), memory = {};
    let state = cabo.create(ids, { expert }, random), actor, command;
    for (let step = 0; step < 1000; step++) {
      let next;
      for (const id of ids) {
        const view = cabo.view(state, id);
        assert.equal(view.deck, undefined);
        const before = JSON.stringify(view);
        memory[id] = cabo.bot.observe(view, id, memory[id], actor === id ? command : null);
        const candidate = cabo.bot.decide(view, id, memory[id]);
        assert.equal(JSON.stringify(view), before);
        if (candidate && !next) next = { id, command: candidate };
      }
      if (state.phase === 'roundEnd' || state.phase === 'finished') {
        assert.equal(next, undefined, 'AI leaves score review to the human host');
        assert.equal(state.history.length, 1); break;
      }
      assert.ok(next, `stalled in ${state.phase}`);
      actor = next.id; command = next.command;
      state = cabo.apply(state, actor, command, { random, isHost: actor === ids[0] });
    }
    assert.ok(['roundEnd', 'finished'].includes(state.phase));
  }
});

test('AI remembers private setup and replacement cards, forgets unknown rival swaps', () => {
  let state = cabo.create(['a', 'b'], {}, () => 0.5);
  state = cabo.apply(state, 'a', { type: 'look', slots: [0, 1] });
  let memory = cabo.bot.observe(cabo.view(state, 'a'), 'a');
  assert.deepEqual(memory.known.a.slice(0, 2), state.players[0].cards.slice(0, 2).map(c => c.value));
  assert.deepEqual(memory.known.a.slice(2), [null, null]);
  assert.deepEqual(memory.known.b, [null, null, null, null]);
  const view = cabo.view(state, 'a');
  view.phase = 'turn'; view.setup = null;
  for (const p of view.players) for (const c of p.cards) c.value = null;
  memory = cabo.bot.observe(view, 'a', { ...memory, phase: 'drawn', turnId: 'a', drawn: 2 }, { type: 'exchange', slots: [2] });
  assert.equal(memory.known.a[2], 2);
  memory = cabo.bot.observe(view, 'a', { ...memory, phase: 'swap', turnId: 'b' });
  assert.deepEqual(memory.known.a, [null, null, null, null]);
});

test('runner ignores chat notifications, revalidates revisions and resumes without leaking state', async t => {
  const { store, rooms, id, act } = fixture();
  act({ type: 'addBot' }); act({ type: 'ready', ready: true }); act({ type: 'start' });
  const errors = [];
  const runner = new BotRunner(rooms, { delay: 10, onError: e => errors.push(e) });
  rooms.notify = id => runner.sync(id); t.after(() => runner.stop()); runner.resume();
  const timer = runner.timers.get(id);
  runner.sync(id); runner.sync(id);
  assert.equal(runner.timers.get(id), timer);
  const botId = store.data.rooms[id].players.find(p => p.isBot).id;
  // A human action supersedes the scheduled revision, while AI setup still completes once.
  act({ type: 'game', command: { type: 'look', slots: [0, 1] } });
  await until(() => rooms.snapshot(id, host).game.players.find(p => p.id === botId).setupDone);
  const view = rooms.snapshot(id, host).game;
  assert.ok(view.players.find(p => p.id === botId).cards.every(c => c.value === null));
  assert.equal(store.data.rooms[id].revision, 6); // add, ready, start, human look, bot look + confirm
  assert.deepEqual(errors, []);
  runner.stop();
  act({ type: 'game', command: { type: 'confirm' } });
  const stoppedRevision = store.data.rooms[id].revision;
  await sleep(30); assert.equal(store.data.rooms[id].revision, stoppedRevision);
});

test('HTTP solo practice survives server restart and AI takes its turn automatically', async t => {
  const store = new JsonStore();
  let app, base;
  async function start() {
    app = createApp({ store, registry: games, random: () => 0.75, botDelay: 5 });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${app.server.address().port}/api`;
  }
  async function close() { app.closeStreams(); await new Promise(resolve => app.server.close(resolve)); }
  await start(); t.after(close);
  let cookie;
  async function request(path, data) {
    const res = await fetch(base + path, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
    cookie ??= res.headers.get('set-cookie')?.split(';')[0];
    assert.ok(res.ok, await res.clone().text()); return res.json();
  }
  const user = await request('/session', { name: 'Solo' });
  let r = await request('/rooms', { gameId: 'cabo', title: 'Solo AI' });
  async function action(input) { r = await request(`/rooms/${r.id}/actions`, { ...input, revision: r.revision }); }
  await action({ type: 'addBot' }); await action({ type: 'ready', ready: true });
  // Persisted lobby carries no AI authentication credentials.
  await close(); await start();
  await action({ type: 'start' });
  await until(() => app.service.snapshot(r.id, user).game.players.find(p => p.id !== user.id).setupDone);
  r = await request(`/rooms/${r.id}`);
  await action({ type: 'game', command: { type: 'look', slots: [0, 1] } });
  await action({ type: 'game', command: { type: 'confirm' } });
  // Restart during the AI's turn. Existing AI roster and game state are sufficient to resume.
  await close(); await start();
  await until(() => { const v = app.service.snapshot(r.id, user).game; return v.phase === 'turn' && v.turnId === user.id; });
  r = await request(`/rooms/${r.id}`);
  assert.equal(r.players.filter(p => p.isBot).length, 1);
  assert.ok(r.revision >= 9);
  assert.equal(r.game.drawn, null);
});
