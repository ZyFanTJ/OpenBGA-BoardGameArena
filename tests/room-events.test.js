import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { RoomEvents } from '../apps/server/room-events.js';
import { RoomService } from '../packages/platform/rooms.js';
import { SessionService } from '../packages/platform/sessions.js';
import { ChatService } from '../packages/platform/chat.js';
import { JsonStore } from '../packages/platform/store.js';
import { createRegistry } from '../packages/games/registry.js';

class Response extends EventEmitter {
  frames = []; writableEnded = false; destroyed = false; writable = true;
  writeHead() {}
  write(frame) { this.frames.push(frame); return this.writable; }
  end() { this.writableEnded = true; this.emit('close'); }
  destroy() { this.destroyed = true; this.emit('close'); }
  last() { return JSON.parse(this.frames.at(-1).split('\n').find(s => s.startsWith('data: ')).slice(6)); }
}
function fixture(t, options) {
  let views = 0, streams;
  const game = {
    manifest: { id: 'events', title: 'Events', minPlayers: 1, maxPlayers: 3, stateVersion: 1 },
    create: () => ({ secret: 'DO-NOT-SEND', count: 0, pending: true }),
    apply: s => ({ ...s, count: s.count + 1 }), isFinished: () => false,
    view: (s, id) => { views++; return { count: s.count, viewer: id }; },
    effect: () => ({ id: 'effect', kind: 'test', input: { secret: 'DO-NOT-SEND' } }),
    presentation: (s, id, { effectProgress }) => ({ caption: typeof effectProgress?.text === 'string' ? effectProgress.text : null, viewer: id }),
  };
  const store = new JsonStore(), sessions = new SessionService(store);
  const rooms = new RoomService(store, createRegistry([game]), { notify: (...args) => streams?.publish(...args) });
  streams = new RoomEvents(rooms, sessions, options); t.after(() => streams.close());
  const a = sessions.create('甲'), b = sessions.create('乙');
  let room = rooms.createRoom(a.user, { gameId: 'events', title: '同步测试' }); room = rooms.join(b.user, room.id);
  for (const user of [a.user, b.user]) room = rooms.mutate(user, room.id, { type: 'ready', ready: true, revision: room.revision });
  room = rooms.mutate(a.user, room.id, { type: 'start', revision: room.revision });
  return { store, sessions, rooms, streams, a, b, room, views: () => views };
}

test('v2 chat and player-projected progress avoid full views; old SSE clients retain snapshots and multi-tabs share projection work', t => {
  const f = fixture(t), a1 = new Response(), a2 = new Response(), b = new Response();
  f.streams.add(f.room.id, a1, f.a.user, f.a.token, 2); f.streams.add(f.room.id, a2, f.a.user, f.a.token, 2);
  f.streams.add(f.room.id, b, f.b.user, f.b.token, 2);
  const before = f.views();
  new ChatService(f.store, f.rooms).send(f.a.user, f.room.id, '你好');
  assert.equal(f.views(), before); assert.equal(a1.last().type, 'chat'); assert.equal(a1.last().message.text, '你好');
  assert.equal(a1.last().game, undefined);
  const effect = f.rooms.registry.get('events').effect(f.store.data.rooms[f.room.id].game);
  f.rooms.publishEffectProgress(f.room.id, { matchId: f.room.matchId, effectId: effect.id,
    fingerprint: JSON.stringify([f.room.matchId, 1, effect]), value: { text: '可见片段', secret: 'DO-NOT-SEND' } });
  assert.equal(f.views(), before); assert.equal(a1.last().game.caption, '可见片段');
  assert.equal(a1.last().game.viewer, f.a.user.id); assert.equal(b.last().game.viewer, f.b.user.id);
  assert.ok(!a1.frames.join('').includes('DO-NOT-SEND'));
  f.rooms.mutate(f.a.user, f.room.id, { type: 'game', command: {}, revision: f.room.revision });
  // One projection for each player, plus the actor's HTTP response projection.
  assert.equal(f.views() - before, 3); assert.equal(a1.last().game.count, 1);
  const old = new Response(); f.streams.add(f.room.id, old, f.b.user, f.b.token);
  f.streams.publish(f.room.id, undefined, { type: 'chat', message: f.store.data.rooms[f.room.id].chat[0] });
  assert.equal(old.last().type, undefined); assert.equal(old.last().chat.length, 1);
});

test('blocked SSE writes coalesce to one fresh private snapshot on drain instead of buffering every event', t => {
  const f = fixture(t), res = new Response(); res.writable = false;
  f.streams.add(f.room.id, res, f.a.user, f.a.token, 2);
  const before = f.views();
  for (let i = 0; i < 100; i++) f.streams.publish(f.room.id, undefined, { type: 'chat', message: { text: String(i) } });
  assert.equal(res.frames.length, 1); assert.equal(f.views(), before);
  res.writable = true; res.emit('drain');
  assert.equal(res.frames.length, 2); assert.equal(res.last().game.viewer, f.a.user.id);
  assert.ok(!res.frames.join('').includes('DO-NOT-SEND'));
});

test('SSE closes revoked sessions and stalled clients and cleans up subscription ownership', async t => {
  const f = fixture(t, { drainTimeoutMs: 10 }), stalled = new Response(); stalled.writable = false;
  f.streams.add(f.room.id, stalled, f.a.user, f.a.token, 2);
  await new Promise(resolve => setTimeout(resolve, 25)); assert.equal(stalled.destroyed, true);
  const res = new Response(); f.streams.add(f.room.id, res, f.a.user, f.a.token, 2);
  f.sessions.revoke(f.a.token); f.streams.publish(f.room.id);
  assert.equal(res.writableEnded, true); assert.equal(f.streams.subscriptions.size, 0);
});

test('SSE response errors close the connection without leaving a subscription or writing after end', t => {
  const f = fixture(t), res = new Response(); f.streams.add(f.room.id, res, f.a.user, f.a.token, 2);
  res.emit('error', new Error('disconnected')); assert.equal(res.destroyed, true);
  assert.equal(f.streams.subscriptions.size, 0);
  const count = res.frames.length; f.streams.fail({ res }, { status: 403 }); assert.equal(res.frames.length, count);
});
