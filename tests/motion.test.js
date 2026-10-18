import test from 'node:test';
import assert from 'node:assert/strict';
import { cabo } from '../packages/games/cabo/index.js';
import { RoomService } from '../packages/platform/rooms.js';
import { JsonStore } from '../packages/platform/store.js';
import { games } from '../packages/games/registry.js';

function apply(before, command, actorId = 'a') {
  const state = cabo.apply(before, actorId, command, { random: () => .4, isHost: true });
  return { state, transition: { before, actorId, command } };
}
function playing() {
  const state = cabo.create(['a', 'b'], {}, () => .4);
  state.phase = 'turn'; state.turn = 0;
  state.players[0].cards = [1, 1, 5, 6].map(value => ({ value, faceUp: false }));
  state.players[1].cards = [3, 4, 8, 9].map(value => ({ value, faceUp: false }));
  return state;
}

test('motion exposes public gestures but never private draw or spy values', () => {
  const initial = playing(); initial.deck.push({ value: 9, faceUp: false });
  let step = apply(initial, { type: 'draw', source: 'deck' });
  let actor = cabo.view(step.state, 'a', step.transition), rival = cabo.view(step.state, 'b', step.transition);
  assert.deepEqual(rival.motion, { kind: 'draw', actorId: 'a', source: 'deck' });
  assert.equal(rival.drawn, null); assert.equal(actor.drawn.value, 9);
  step = apply(step.state, { type: 'discard', useAbility: true });
  assert.equal(cabo.view(step.state, 'b', step.transition).motion.ability, 'spy');
  step = apply(step.state, { type: 'ability', targetId: 'b', slot: 2 });
  actor = cabo.view(step.state, 'a', step.transition); rival = cabo.view(step.state, 'b', step.transition);
  assert.equal(actor.reveal.value, 8); assert.equal(rival.reveal, null);
  assert.equal(rival.players[1].cards[2].value, null);
  assert.deepEqual(rival.motion, { kind: 'spy', actorId: 'a', targets: [{ playerId: 'b', slot: 2 }] });
  step = apply(step.state, { type: 'confirm' });
  assert.deepEqual(cabo.view(step.state, 'b', step.transition).motion.targets, [{ playerId: 'b', slot: 2 }]);
  assert.equal(cabo.view(step.state, 'b').motion, null, 'reconnection does not replay old gestures');
});

test('same-looking hidden swaps and multi-card exchange outcomes have explicit motion', () => {
  const initial = playing(); initial.phase = 'swap';
  let step = apply(initial, { type: 'ability', ownSlot: 2, targetId: 'b', slot: 0 });
  assert.deepEqual(cabo.view(step.state, 'b', step.transition).motion, { kind: 'swap', actorId: 'a',
    targets: [{ playerId: 'a', slot: 2 }, { playerId: 'b', slot: 0 }] });
  assert.ok(cabo.view(step.state, 'b').players.every(p => p.cards.every(c => c.value === null)));
  for (const expert of [false, true]) for (const slots of [[0, 1], [0, 2, 3]]) {
    const state = playing(); state.expert = expert;
    step = apply(state, { type: 'draw', source: 'deck' });
    step = apply(step.state, { type: 'exchange', slots, replaceAt: slots[0], end: 'left' });
    const view = cabo.view(step.state, 'b', step.transition);
    assert.equal(view.motion.success, slots.length === 2);
    assert.deepEqual(view.motion.slots, slots);
    assert.equal(view.motion.end, 'left');
    if (expert) assert.ok(view.players[0].cards.every(c => c.value === null));
    assert.equal(view.motion.value, undefined);
  }
});

test('room transaction publishes the same projected motion in push and response, never persistence', () => {
  const store = new JsonStore(), host = { id: 'a', name: 'A' }, other = { id: 'b', name: 'B' };
  const pushed = [];
  const rooms = new RoomService(store, games, { random: () => 0, notify(id, transition) {
    pushed.push(rooms.snapshot(id, other, transition));
  } });
  const id = rooms.createRoom(host, { gameId: 'cabo', title: 'Animation' }).id;
  rooms.join(other, id);
  const act = (user, input) => rooms.mutate(user, id, { revision: store.data.rooms[id].revision, ...input });
  act(host, { type: 'ready', ready: true }); act(other, { type: 'ready', ready: true });
  const started = act(host, { type: 'start' });
  assert.equal(started.game.motion.kind, 'deal');
  const looked = act(host, { type: 'game', command: { type: 'look', slots: [0, 1] } });
  assert.deepEqual(pushed.at(-1).game.motion, looked.game.motion);
  assert.ok(pushed.at(-1).game.players[0].cards.every(c => c.value === null));
  assert.equal(rooms.snapshot(id, host).game.motion, null);
  const count = pushed.length;
  assert.throws(() => act(host, { type: 'game', command: { type: 'look', slots: [0, 1] } }));
  assert.equal(pushed.length, count, 'rejected actions never emit effects');
  assert.ok(!JSON.stringify(store.data.rooms[id].game).includes('motion'));
  assert.equal(store.data.rooms[id].stateVersion, 1);
});
