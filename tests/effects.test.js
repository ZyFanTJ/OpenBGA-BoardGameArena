import test from 'node:test';
import assert from 'node:assert/strict';
import { EffectRunner } from '../packages/platform/effects.js';
import { RoomService } from '../packages/platform/rooms.js';
import { JsonStore } from '../packages/platform/store.js';
import { SessionService } from '../packages/platform/sessions.js';
import { createRegistry } from '../packages/games/registry.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) { for (let i = 0; i < 150; i++) { if (fn()) return; await sleep(5); } assert.fail('Expected asynchronous effect to settle'); }
const plugin = {
  manifest: { id: 'effect-test', title: 'Effects', minPlayers: 1, maxPlayers: 4, stateVersion: 1 },
  create: () => ({ pending: true, number: 1, count: 0, secret: 'NEVER-CLIENT' }),
  apply: s => s,
  view: s => ({ count: s.count }),
  isFinished: () => false,
  effect: s => s.pending ? { id: String(s.number), kind: 'test', input: { n: s.number } } : null,
  applyEffect: (s, id, result) => ({ ...s, pending: false, count: s.count + 1, result }),
};
function setup(options = {}) {
  const store = new JsonStore(); let runner;
  const service = new RoomService(store, createRegistry([plugin]), { notify: id => runner?.sync(id) });
  const sessions = new SessionService(store), a = sessions.create('a').user, b = sessions.create('b').user;
  let room = service.createRoom(a, { gameId: 'effect-test', title: 't' });
  room = service.join(b, room.id);
  for (const user of [a, b]) room = service.mutate(user, room.id, { type: 'ready', ready: true, revision: room.revision });
  room = service.mutate(a, room.id, { type: 'start', revision: room.revision });
  runner = new EffectRunner(service, { ...options, onError: error => assert.fail(error?.message ?? 'Unexpected commit error') });
  return { store, service, runner, a, b, id: room.id };
}

test('Streaming progress is ephemeral, projected by each game, and rejects obsolete jobs', async t => {
  let progress, release;
  const f = setup({ providers: { test: (_, context) => { progress = context.onProgress; return new Promise(resolve => { release = resolve; }); } } });
  t.after(() => f.runner.stop()); f.runner.resume(); await until(() => !!progress);
  const before = JSON.stringify(f.store.data), revision = f.store.data.rooms[f.id].revision;
  progress({ text: 'PARTIAL-PRIVATE', other: 'NEVER-CLIENT' });
  assert.equal(JSON.stringify(f.store.data), before);
  const snapshot = f.service.snapshot(f.id, f.a);
  assert.equal(snapshot.revision, revision); assert.ok(snapshot.presentationRevision > 0);
  assert.ok(!JSON.stringify(snapshot).includes('PARTIAL-PRIVATE'));
  assert.ok(!JSON.stringify(snapshot).includes('NEVER-CLIENT'));
  const job = f.runner.job(f.id);
  assert.equal(f.service.publishEffectProgress(f.id, { ...job, effectId: job.effect.id, fingerprint: 'old', value: {} }), false);
  assert.equal(f.service.publishEffectProgress(f.id, { ...job, effectId: job.effect.id, matchId: 'previous', value: {} }), false);
  release({ source: 'ai', value: {} }); await until(() => !f.runner.active.size);
  assert.equal(f.service.effectProgress.size, 0);
  assert.equal(f.service.snapshot(f.id, f.a).presentationRevision, 0);
});

test('Effects run outside transactions, deduplicate notifications, recheck revisions and reuse only unchanged requests', async t => {
  let resolve, calls = 0;
  const f = setup({ providers: { test: async () => { calls++; return new Promise(r => { resolve = r; }); } } });
  t.after(() => f.runner.stop()); f.runner.resume(); await until(() => calls === 1);
  for (let i = 0; i < 5; i++) f.runner.sync(f.id);
  assert.equal(calls, 1); assert.equal(f.store.data.rooms[f.id].game.count, 0);
  const revision = f.store.data.rooms[f.id].revision;
  f.store.transaction(data => { data.rooms[f.id].revision++; });
  assert.equal(f.service.completeEffect(f.id, { revision, matchId: f.store.data.rooms[f.id].matchId, effectId: '1', result: {} }), false);
  resolve({ source: 'ai', value: { ok: true } }); await until(() => f.store.data.rooms[f.id].game.count === 1);
  assert.equal(calls, 1); assert.equal(f.store.data.rooms[f.id].revision, revision + 2);
  assert.deepEqual(f.service.snapshot(f.id, f.b).game, { count: 1 });
  f.runner.sync(f.id); assert.equal(calls, 1);
});

test('Dissolution pauses completion; rejecting it resumes cached response without another paid request', async t => {
  let resolve, calls = 0;
  const f = setup({ providers: { test: () => { calls++; return new Promise(r => { resolve = r; }); } } });
  t.after(() => f.runner.stop()); f.runner.resume(); await until(() => calls === 1);
  let room = f.service.mutate(f.a, f.id, { type: 'requestDissolve', revision: f.store.data.rooms[f.id].revision });
  resolve({ source: 'ai', value: {} }); await until(() => !f.runner.active.size);
  assert.equal(f.store.data.rooms[f.id].game.count, 0);
  f.service.mutate(f.b, f.id, { type: 'voteDissolve', agree: false, voteId: room.dissolution.id, revision: room.revision });
  await until(() => f.store.data.rooms[f.id].game.count === 1); assert.equal(calls, 1);
});

test('Timeouts fall back once, restart recovers pending requests and deleted rooms reject late completions', async t => {
  const f = setup({ providers: { test: () => new Promise(() => {}) }, timeoutMs: 12 });
  t.after(() => f.runner.stop()); f.runner.resume();
  await until(() => f.store.data.rooms[f.id].game.count === 1);
  assert.equal(f.store.data.rooms[f.id].game.result.source, 'fallback');
  f.runner.stop();
  f.store.transaction(data => { data.rooms[f.id].game.pending = true; data.rooms[f.id].game.number++; data.rooms[f.id].revision++; });
  const resumed = new EffectRunner(f.service); t.after(() => resumed.stop()); resumed.resume();
  await until(() => f.store.data.rooms[f.id].game.count === 2);
  let resolve;
  const other = setup({ providers: { test: () => new Promise(r => { resolve = r; }) } }); t.after(() => other.runner.stop());
  other.runner.resume(); await until(() => !!resolve);
  other.store.transaction(data => { delete data.rooms[other.id]; }); other.runner.sync(other.id);
  resolve({ source: 'ai', value: { late: true } }); await until(() => !other.runner.active.size);
  assert.equal(other.store.data.rooms[other.id], undefined); assert.equal(other.runner.cache.size, 0);
});

test('Changed request payload and match identity invalidate cached model output', async t => {
  const resolves = []; let calls = 0;
  const f = setup({ providers: { test: () => { calls++; return new Promise(r => resolves.push(r)); } } });
  t.after(() => f.runner.stop()); f.runner.resume(); await until(() => calls === 1);
  f.store.transaction(data => { data.rooms[f.id].game.number = 2; data.rooms[f.id].revision++; });
  resolves[0]({ source: 'ai', value: { old: true } }); await until(() => calls === 2);
  assert.equal(f.store.data.rooms[f.id].game.count, 0);
  resolves[1]({ source: 'ai', value: { fresh: true } }); await until(() => f.store.data.rooms[f.id].game.count === 1);
  assert.deepEqual(f.store.data.rooms[f.id].game.result.value, { fresh: true });
});
