import test from 'node:test';
import assert from 'node:assert/strict';
import { api, parseRoomEvent, mergeRoomEvent } from '../apps/web/api.js';
import { createRoomCommands } from '../apps/web/room-commands.js';

test('API bounds both connection and body waits, marks uncertain writes and never replays them', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_, { signal }) => {
    calls++; return { text: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) };
  });
  await assert.rejects(api('/rooms/ABCD1234/actions', {}, { timeoutMs: 10 }), error => error.mayHaveCommitted && /超时/.test(error.message));
  assert.equal(calls, 1);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })));
  await assert.rejects(api('/me', undefined, { timeoutMs: 10 }), error => !error.mayHaveCommitted && /超时/.test(error.message));
});

const base = () => ({ id: 'ABCD1234', matchId: 'match', revision: 4, presentationRevision: 0, game: { cards: ['private-own'], narrationStream: null }, chat: [] });
const message = (id, at = 1) => ({ id, at, name: '甲', userId: 'a', text: id });
test('chat patches preserve game identity, deduplicate delivery and survive late HTTP snapshots; missing revisions require recovery', () => {
  const room = base(), event = { type: 'chat', id: room.id, revision: 4, message: message('one') };
  assert.deepEqual(parseRoomEvent(JSON.stringify(event)), event);
  const merged = mergeRoomEvent(room, event);
  assert.equal(merged.game, room.game); assert.equal(merged.chat.length, 1);
  assert.equal(mergeRoomEvent(merged, event), merged);
  assert.equal(mergeRoomEvent(merged, room).chat[0].id, 'one');
  assert.equal(mergeRoomEvent(room, { ...event, revision: 5 }), null);
  assert.equal(parseRoomEvent(JSON.stringify({ ...event, message: { text: 'invalid' } })), null);
});

test('presentation patches are revision/match/sequence scoped and reconnect can reset a restarted server sequence', () => {
  const room = base(), event = { type: 'presentation', id: room.id, matchId: room.matchId, revision: 4, presentationRevision: 9, game: { narrationStream: { id: 'n', text: '片段' } } };
  assert.deepEqual(parseRoomEvent(JSON.stringify(event)), event);
  const merged = mergeRoomEvent(room, event);
  assert.deepEqual(merged.game.cards, room.game.cards); assert.equal(merged.game.narrationStream.text, '片段');
  assert.equal(mergeRoomEvent(merged, event), merged);
  assert.equal(mergeRoomEvent(merged, room).presentationRevision, 9);
  assert.equal(mergeRoomEvent(merged, room, { resetPresentation: true }).presentationRevision, 0);
  assert.equal(mergeRoomEvent(room, { ...event, matchId: 'other' }), null);
});

test('pending room commands reject duplicate writes but do not hold a global UI lock; late room responses stay in their original room', async () => {
  let room = base(), release, received = 0, calls = 0;
  const send = createRoomCommands({ getRoom: () => room, receive: () => received++, left: () => assert.fail('late exit'),
    request: (path, input) => { calls++; assert.equal(input.matchId, 'match'); return new Promise(resolve => release = resolve); } });
  const first = send({ type: 'game', command: {} });
  await assert.rejects(send({ type: 'ready' }), /仍在提交/); assert.equal(calls, 1);
  room = { ...base(), id: 'ZZZZ1234' }; release({ left: true }); await first;
  assert.equal(received, 0);
  const next = send({ type: 'game', command: {} }); release({ ...room, revision: 5 }); await next; assert.equal(received, 1);
});

test('failed/uncertain writes release their room gate and attach room identity for scoped recovery', async () => {
  const room = base(); let calls = 0;
  const send = createRoomCommands({ getRoom: () => room, receive() {}, left() {}, request: async () => { calls++; throw Object.assign(new Error('timeout'), { mayHaveCommitted: true }); } });
  for (let i = 0; i < 2; i++) await assert.rejects(send({ type: 'game' }), error => error.roomId === room.id && error.mayHaveCommitted);
  assert.equal(calls, 2);
});
