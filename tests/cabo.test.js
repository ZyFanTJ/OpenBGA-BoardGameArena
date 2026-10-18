import test from 'node:test';
import assert from 'node:assert/strict';
import { cabo, makeDeck } from '../packages/games/cabo/index.js';
import { scoreRound, settleScores } from '../packages/games/cabo/scoring.js';

const card = (value, faceUp = false) => ({ value, faceUp });
const seed = () => { let x = 42; return () => ((x = (1664525 * x + 1013904223) >>> 0) / 2 ** 32); };
function state(hands = [[1, 2, 3, 4], [4, 5, 6, 7]], values = [5, 6, 7]) {
  const s = cabo.create(hands.map((_, i) => `p${i}`), {}, seed());
  s.players.forEach((p, i) => { p.cards = hands[i].map(v => card(v)); });
  s.phase = 'turn'; s.turn = 0; s.starter = 0; s.deck = values.map(v => card(v)); s.discard = [card(8, true)];
  return s;
}
const act = (s, command, id = s.players[s.turn].id, isHost = true) => cabo.apply(s, id, command, { random: seed(), isHost });
function draw(s, value, source = 'deck') { s = structuredClone(s); s[source === 'deck' ? 'deck' : 'discard'].push(card(value)); return act(s, { type: 'draw', source }); }

test('deck composition, 2–4 seats and immutable state transitions', () => {
  const deck = makeDeck(); assert.equal(deck.length, 52);
  for (let n = 0; n <= 13; n++) assert.equal(deck.filter(c => c.value === n).length, n === 0 || n === 13 ? 2 : 4);
  assert.throws(() => cabo.create(['p0'])); assert.throws(() => cabo.create(['p0', 'p0']));
  const s = state(); const copy = structuredClone(s); act(s, { type: 'draw', source: 'deck' }); assert.deepEqual(s, copy);
});
test('setup reveals exactly two chosen cards once, then forgets them in every projection', () => {
  let s = cabo.create(['p0', 'p1'], {}, seed());
  assert.throws(() => act(s, { type: 'look', slots: [0, 0] }, 'p0'));
  s = act(s, { type: 'look', slots: [1, 3] }, 'p0');
  assert.equal(cabo.view(s, 'p0').players[0].cards.filter(c => c.value !== null).length, 2);
  assert.ok(cabo.view(s, 'p1').players[0].cards.every(c => c.value === null));
  assert.throws(() => act(s, { type: 'look', slots: [0, 2] }, 'p0'));
  s = act(s, { type: 'confirm' }, 'p0');
  assert.ok(cabo.view(s, 'p0').players[0].cards.every(c => c.value === null));
  s = act(s, { type: 'look', slots: [0, 2] }, 'p1'); s = act(s, { type: 'confirm' }, 'p1');
  assert.equal(s.phase, 'turn');
});
test('illegal actor, phase and card selections are rejected without mutation', () => {
  const s = state();
  assert.throws(() => act(s, { type: 'draw', source: 'deck' }, 'p1'));
  assert.throws(() => act(s, { type: 'exchange', slots: [0] }));
  const d = draw(s, 2);
  for (const slots of [[], [0, 0], [-1], [99], [0.5]]) assert.throws(() => act(d, { type: 'exchange', slots }));
  assert.throws(() => act(d, { type: 'cabo' }));
});
test('discard pickup must exchange and stays public; deck replacement is hidden', () => {
  let s = draw(state(), 1, 'discard');
  assert.throws(() => act(s, { type: 'discard', useAbility: true }));
  s = act(s, { type: 'exchange', slots: [2] });
  assert.equal(s.players[0].cards[2].faceUp, true);
  assert.equal(cabo.view(s, 'p1').players[0].cards[2].value, 1);
  s = act(draw(state(), 1), { type: 'exchange', slots: [2] });
  assert.equal(cabo.view(s, 'p0').players[0].cards[2].value, null);
});
test('matching exchange preserves survivor order and chosen replacement position', () => {
  let s = draw(state([[4, 2, 4, 8], [1, 2, 3, 4]]), 0);
  s = act(s, { type: 'exchange', slots: [0, 2], replaceAt: 2 });
  assert.deepEqual(s.players[0].cards.map(c => c.value), [2, 0, 8]);
  assert.deepEqual(s.discard.slice(-2).map(c => c.value), [4, 4]);
});
test('two-card failed exchange exposes originals and adds drawn card without penalty', () => {
  const s = act(draw(state(), 0), { type: 'exchange', slots: [0, 1] });
  assert.equal(s.players[0].cards.length, 5); assert.equal(s.deck.length, 3);
  assert.deepEqual(s.players[0].cards.slice(0, 2).map(c => c.faceUp), [true, true]);
  assert.equal(s.players[0].cards.at(-1).faceUp, false);
});
test('three-card failed exchange adds unseen penalty, supports left end', () => {
  const s = act(draw(state(), 0, 'discard'), { type: 'exchange', slots: [0, 1, 2], end: 'left' });
  assert.equal(s.players[0].cards.length, 6); assert.equal(s.deck.length, 2);
  assert.equal(s.players[0].cards[0].value, 0); assert.equal(s.players[0].cards[0].faceUp, true);
  assert.equal(s.players[0].cards[1].faceUp, false);
  assert.equal(cabo.view(s, 'p0').players[0].cards[1].value, null);
});
for (const value of [7, 8, 9, 10]) test(`ability ${value} reveals only legal hidden target only to actor`, () => {
  let s = act(draw(state(), value), { type: 'discard', useAbility: true });
  const targetId = value <= 8 ? 'p0' : 'p1';
  assert.throws(() => act(s, { type: 'ability', targetId: value <= 8 ? 'p1' : 'p0', slot: 0 }));
  s = act(s, { type: 'ability', targetId, slot: 0 });
  assert.equal(s.phase, 'reveal'); assert.notEqual(cabo.view(s, 'p0').reveal, null);
  assert.equal(cabo.view(s, 'p1').reveal, null);
  s = act(s, { type: 'confirm' }); assert.equal(cabo.view(s, 'p0').reveal, null); assert.equal(s.turn, 1);
});
for (const value of [11, 12]) test(`ability ${value} swaps without flipping or exposing hidden identity`, () => {
  let s = state(); s.players[1].cards[0].faceUp = true;
  s = act(draw(s, value), { type: 'discard', useAbility: true });
  s = act(s, { type: 'ability', targetId: 'p1', slot: 0, ownSlot: 0 });
  assert.deepEqual(s.players[0].cards[0], card(4, true));
  assert.deepEqual(s.players[1].cards[0], card(1));
  assert.equal(cabo.view(s, 'p1').players[1].cards[0].value, null);
});
test('abilities are optional and faceup cards cannot be peeked', () => {
  let s = state(); s.players[0].cards[0].faceUp = true;
  s = act(draw(s, 7), { type: 'discard', useAbility: true });
  assert.throws(() => act(s, { type: 'ability', targetId: 'p0', slot: 0 }));
  assert.equal(act(s, { type: 'skip' }).turn, 1);
  assert.equal(act(draw(state(), 7), { type: 'discard' }).turn, 1);
});
test('CABO grants exactly one final turn to each other player', () => {
  let s = state([[1], [2], [3], [4]], [1, 2, 3, 4, 5]);
  s = act(s, { type: 'cabo' });
  for (let i = 1; i < 4; i++) {
    assert.equal(s.turn, i); assert.throws(() => act(s, { type: 'cabo' }));
    s = act(s, { type: 'draw', source: 'deck' }); s = act(s, { type: 'discard' });
  }
  assert.equal(s.phase, 'roundEnd'); assert.deepEqual(s.history[0].results.map(r => r.points), [0, 2, 3, 4]);
});
test('last draw resolves its exchange/ability before exhaustion ends round', () => {
  let s = state([[1], [2]], [7]);
  s = act(s, { type: 'draw', source: 'deck' }); assert.equal(s.phase, 'drawn');
  s = act(s, { type: 'discard', useAbility: true }); assert.equal(s.phase, 'peek');
  s = act(s, { type: 'ability', targetId: 'p0', slot: 0 });
  s = act(s, { type: 'confirm' }); assert.equal(s.phase, 'roundEnd');
});
test('calling tie scores zero; unsuccessful call adds 10; Kamikaze overrides', () => {
  assert.deepEqual(scoreRound(state([[1, 2], [3]]).players, 'p0').map(r => r.points), [0, 3]);
  assert.deepEqual(scoreRound(state([[5], [3]]).players, 'p0').map(r => r.points), [15, 3]);
  assert.deepEqual(scoreRound(state([[13, 12, 13, 12], [0]]).players, 'p1').map(r => r.points), [0, 50]);
  assert.equal(scoreRound(state([[13, 12, 13, 12, 0], [0]]).players, null)[0].points, 50);
});
test('exactly 100 resets once; next 100 stays, greater than 100 finishes', () => {
  const players = state().players; players[0].total = 90;
  let scored = settleScores(players, [{ points: 10 }, { points: 0 }]);
  assert.equal(scored[0].total, 50); assert.equal(scored[0].resetUsed, true);
  scored = settleScores(scored, [{ points: 50 }, { points: 0 }]); assert.equal(scored[0].total, 100);
  let s = state([[1], [1]], [2]); s.players[0].total = 100; s.players[0].resetUsed = true;
  s = act(act(s, { type: 'draw', source: 'deck' }), { type: 'discard' });
  assert.equal(s.phase, 'finished'); assert.deepEqual(s.winners, ['p1']);
});
test('next starter follows round score and clockwise tie; only host advances', () => {
  let s = state([[4], [1], [1]], [2]); s.starter = 2;
  s = act(act(s, { type: 'draw', source: 'deck' }), { type: 'discard' });
  assert.throws(() => act(s, { type: 'nextRound' }, 'p0', false));
  s = act(s, { type: 'nextRound' }); assert.equal(s.starter, 2); assert.equal(s.round, 2);
  assert.equal(s.players[0].total, 4); assert.equal(s.phase, 'setup');
});
test('final tied totals break on last-round points, complete ties share victory', () => {
  let s = state([[3], [1], [5]], [2]); s.players[0].total = 7; s.players[1].total = 9; s.players[2].total = 100;
  s = act(act(s, { type: 'draw', source: 'deck' }), { type: 'discard' }); assert.deepEqual(s.winners, ['p1']);
  s = state([[1], [1], [5]], [2]); s.players[0].total = 9; s.players[1].total = 9; s.players[2].total = 100;
  s = act(act(s, { type: 'draw', source: 'deck' }), { type: 'discard' }); assert.deepEqual(s.winners, ['p0', 'p1']);
});
test('expert mode keeps replacements and failed-exchange cards facedown', () => {
  let s = state(); s.expert = true;
  s = act(draw(s, 0, 'discard'), { type: 'exchange', slots: [0, 1] });
  assert.ok(s.players[0].cards.every(c => !c.faceUp));
});
test('complete seeded match conserves all 52 cards and hides every private card', () => {
  const random = seed(); let s = cabo.create(['p0', 'p1', 'p2', 'p3'], {}, random); let steps = 0;
  while (s.phase !== 'finished' && steps++ < 5000) {
    if (s.phase === 'setup') for (const p of s.players) {
      s = act(s, { type: 'look', slots: [0, 1] }, p.id); s = act(s, { type: 'confirm' }, p.id);
    }
    else if (s.phase === 'roundEnd') s = act(s, { type: 'nextRound' });
    else if (s.phase === 'turn') s = act(s, { type: 'draw', source: 'deck' });
    else if (s.phase === 'drawn') s = act(s, random() < .6 ? { type: 'exchange', slots: [Math.floor(random() * s.players[s.turn].cards.length)] } : { type: 'discard' });
    const all = [...s.deck, ...s.discard, ...s.players.flatMap(p => p.cards), ...(s.drawn ? [s.drawn] : [])];
    assert.equal(all.length, 52);
    for (let value = 0; value <= 13; value++) assert.equal(all.filter(c => c.value === value).length, value === 0 || value === 13 ? 2 : 4);
    if (!['roundEnd', 'finished', 'setup'].includes(s.phase)) for (const viewer of s.players) {
      const v = cabo.view(s, viewer.id); assert.equal(v.deck, undefined);
      v.players.forEach(p => p.cards.forEach(c => { if (!c.faceUp) assert.equal(c.value, null); }));
      if (viewer.id !== s.players[s.turn].id) assert.equal(v.drawn, null);
    }
  }
  assert.equal(s.phase, 'finished'); assert.ok(s.winners.length);
});
