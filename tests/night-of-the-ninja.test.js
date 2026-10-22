import test from 'node:test';
import assert from 'node:assert/strict';
import { nightOfTheNinja as game } from '../packages/games/night-of-the-ninja/index.js';
import { ninjaDeck } from '../packages/games/night-of-the-ninja/cards.js';
import { createNinjaRenderer } from '../apps/web/games/night-of-the-ninja/index.js';

const ids = ['a', 'b', 'c', 'd'];
const rng = (seed = 10) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const card = (role, rank = 1) => ninjaDeck().find(c => c.role === role && (c.rank === rank || !c.rank || !['spy', 'mystic', 'shinobi', 'blindAssassin'].includes(role)));
function acting(role, rank = 1) {
  const s = game.create(ids, {}, rng());
  s.phase = 'act'; s.nightPhase = { spy: 1, mystic: 2, blindAssassin: 4, shinobi: 5 }[role] ?? 3;
  s.players.forEach((p, i) => { p.hand = []; p.pack = []; p.house = { house: i % 2 ? 'lotus' : 'crane', rank: i < 2 ? 1 : 2 }; p.intel = []; });
  s.active = { playerId: 'a', card: card(role, rank) }; s.players[0].played = [s.active.card]; return s;
}
const apply = (s, id, command, random = rng()) => game.apply(s, id, command, { random, isHost: id === 'a' });
function announceAll(s, offerings = {}) {
  for (const p of s.players.filter(p => p.alive)) s = apply(s, p.id, { type: 'announce', cardIds: offerings[p.id] ?? [] });
  return s;
}

test('Ninja core deck, balanced identities, validation, deterministic creation and JSON persistence', () => {
  assert.equal(ninjaDeck().length, 33); assert.equal(new Set(ninjaDeck().map(c => c.id)).size, 33);
  for (const count of [4, 5, 10, 11]) {
    const players = Array.from({ length: count }, (_, i) => String(i));
    const s = game.create(players, {}, rng(10));
    assert.deepEqual(s, game.create(players, {}, rng(10)));
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
    assert.equal(s.players.filter(p => p.house.house === 'ronin').length, count % 2);
    assert.equal(s.players.filter(p => p.house.house === 'crane').length, Math.floor(count / 2));
    assert.equal(s.players.flatMap(p => p.pack).length, count * 3);
  }
  for (const list of [ids.slice(0, 3), [...ids, ...ids], Array(12).fill('a'), ['a', 'b', 'c', null]]) assert.throws(() => game.create(list, {}, rng()));
  assert.throws(() => game.create(ids, { houseRule: true }, rng()));
  assert.throws(() => game.create(ids, {}, () => 1));
});

test('simultaneous draft locks once, passes left, conceals choices and creates two-card hands', () => {
  let s = game.create(ids, {}, rng()); const original = structuredClone(s), first = s.players[0].pack[0];
  s = apply(s, 'a', { type: 'draft', cardId: first.id });
  assert.deepEqual(original.players[0].hand, []); assert.equal(original.sequence, 0);
  assert.throws(() => apply(s, 'a', { type: 'draft', cardId: first.id }));
  assert.throws(() => apply(s, 'b', { type: 'draft', cardId: first.id }));
  assert.equal(game.view(s, 'b').selected, null);
  for (const id of ids.slice(1)) s = apply(s, id, { type: 'draft', cardId: s.players.find(p => p.id === id).pack[0].id });
  assert.equal(s.draftStep, 2);
  assert.deepEqual(s.players[1].pack, original.players[0].pack.slice(1));
  assert.equal(s.players[0].hand[0].id, first.id);
  for (const id of ids) s = apply(s, id, { type: 'draft', cardId: s.players.find(p => p.id === id).pack[0].id });
  assert.equal(s.phase, 'announce'); assert.equal(s.nightPhase, 1);
  assert.ok(s.players.every(p => p.hand.length === 2 && p.pack.length === 0)); assert.equal(s.discards.length, 4);
});

test('announcement stays private until everyone commits, resolves rank order and never repeats an empty phase', () => {
  let s = acting('spy'); s.phase = 'announce'; s.active = null; s.players[0].played = [];
  s.players[0].hand = [card('spy', 5), card('spy', 2)]; s.players[1].hand = [card('spy', 3)];
  s = apply(s, 'a', { type: 'announce', cardIds: ['spy-5', 'spy-2'] });
  assert.equal(game.view(s, 'b').players[0].hand[0], null); assert.equal(game.view(s, 'b').queue.length, 0);
  assert.throws(() => apply(s, 'a', { type: 'announce', cardIds: [] }));
  assert.throws(() => apply(s, 'b', { type: 'announce', cardIds: ['spy-2'] }));
  for (const id of ids.slice(1)) s = apply(s, id, { type: 'announce', cardIds: id === 'b' ? ['spy-3'] : [] });
  assert.equal(s.active.card.rank, 2); assert.deepEqual(s.queue.map(q => q.card.rank), [3, 5]);
  assert.throws(() => apply(s, 'b', { type: 'act', targetId: 'c' }), { status: 403 });
  s = apply(s, 'a', { type: 'act', targetId: 'b' });
  assert.equal(game.view(s, 'a').pending.house.house, 'lotus');
  assert.equal(game.view(s, 'b').pending.house, undefined);
  s = apply(s, 'a', { type: 'decide' }); assert.equal(s.active.card.rank, 3);
  // Skip an empty role phase without asking anyone to expose whether they hold that role.
  let empty = acting('spy'); empty.phase = 'announce'; empty.active = null;
  empty = announceAll(empty); assert.equal(empty.nightPhase, 2);
  empty = announceAll(empty); assert.equal(empty.nightPhase, 3);
});

test('Mystic chooses a private random hand card; Shapeshifter cannot leak its secret swap to a target', () => {
  let s = acting('mystic'); s.players[1].hand = [card('spy', 4), card('shinobi', 2)];
  s = apply(s, 'a', { type: 'act', targetId: 'b' }, () => .99);
  assert.equal(game.view(s, 'a').pending.ninja.id, 'shinobi-2'); assert.equal(game.view(s, 'c').pending.ninja, undefined);
  s = acting('shapeshifter'); s.players[1].intel.push({ sequence: 0, playerId: 'b', house: structuredClone(s.players[1].house) });
  s = apply(s, 'a', { type: 'act', targetIds: ['b', 'c'] }); const before = structuredClone(s);
  const swapped = apply(s, 'a', { type: 'decide', swap: true }), kept = apply(s, 'a', { type: 'decide', swap: false });
  assert.deepEqual(swapped.players[1].house, before.players[2].house);
  assert.deepEqual(game.view(swapped, 'b'), game.view(kept, 'b'), 'swapped players retain old observations and cannot tell whether cards moved');
  assert.notDeepEqual(game.view(swapped, 'a').intel, game.view(kept, 'a').intel);
});

test('Troublemaker reveals only on request; Shinobi may spare a viewed ally', () => {
  for (const reveal of [true, false]) {
    let s = acting('troublemaker'); s = apply(s, 'a', { type: 'act', targetId: 'b' });
    assert.equal(game.view(s, 'c').players[1].house, null);
    s = apply(s, 'a', { type: 'decide', reveal }); assert.equal(!!game.view(s, 'c').players[1].house, reveal);
  }
  let s = acting('shinobi'); s = apply(s, 'a', { type: 'act', targetId: 'b' });
  assert.equal(s.phase, 'decision'); s = apply(s, 'a', { type: 'decide', kill: false });
  assert.equal(s.players[1].alive, true); assert.equal(s.phase, 'roundEnd');
});

test('Mirror Monk reflects, Martyr awards but still dies, and Judge disallows both reactions', () => {
  for (const reaction of ['accept', 'mirrorMonk', 'martyr']) {
    let s = acting('blindAssassin'); s.players[1].hand = [card('mirrorMonk'), card('martyr')];
    s = apply(s, 'a', { type: 'act', targetId: 'b' });
    assert.throws(() => apply(s, 'c', { type: 'decide', choice: reaction }), { status: 403 });
    s = apply(s, 'b', { type: 'decide', choice: reaction });
    assert.equal(s.players[0].alive, reaction !== 'mirrorMonk'); assert.equal(s.players[1].alive, reaction === 'mirrorMonk');
    assert.equal(s.players[1].honor.length, reaction === 'martyr' ? 1 : 0);
    assert.equal(game.view(s, 'c').players[1].house, null);
  }
  let s = acting('judge'); s.players[1].hand = [card('mirrorMonk'), card('martyr')];
  s = apply(s, 'a', { type: 'act', targetId: 'b' }); assert.notEqual(s.phase, 'react'); assert.equal(s.players[1].alive, false);
  assert.ok(game.view(s, 'c').players[0].house); assert.equal(game.view(s, 'c').players[1].house, null);
  assert.throws(() => apply(acting('blindAssassin'), 'a', { type: 'act', targetId: 'a' }));
});

test('Gravedigger samples only actual discards and supports immediate out-of-order play or keeping a reaction', () => {
  let s = acting('gravedigger'); s.discards = [card('spy', 4), card('mirrorMonk')];
  s = apply(s, 'a', { type: 'act' }); assert.equal(s.pending.cards.length, 2);
  assert.equal(game.view(s, 'b').pending.cards, undefined);
  assert.throws(() => apply(s, 'a', { type: 'decide', cardId: 'judge', immediate: true }));
  const keep = apply(s, 'a', { type: 'decide', cardId: 'mirrorMonk', immediate: false });
  assert.ok(keep.players[0].hand.some(c => c.role === 'mirrorMonk'));
  s = apply(s, 'a', { type: 'decide', cardId: 'spy-4', immediate: true });
  assert.equal(s.active.card.id, 'spy-4'); assert.equal(s.nightPhase, 3);
  s = apply(s, 'a', { type: 'act', targetId: 'b' }); s = apply(s, 'a', { type: 'decide' }); assert.equal(s.nightPhase, 4);
  assert.ok(!s.discards.some(c => c.id === 'spy-4'));
});

test('Spirit Merchant privately inspects one token and may swap a different one; Thief compares token count', () => {
  let s = acting('spiritMerchant'); s.players[0].honor = [2]; s.players[1].honor = [3, 4];
  s = apply(s, 'a', { type: 'act', targetId: 'b', inspect: 'honor', token: 0 });
  assert.deepEqual(game.view(s, 'a').pending.token, { slot: 0, value: 3 }); assert.equal(game.view(s, 'b').pending.token, undefined);
  s = apply(s, 'a', { type: 'decide', swap: true, ownToken: 0, otherToken: 1 });
  assert.deepEqual(s.players[0].honor, [4]); assert.deepEqual(s.players[1].honor, [3, 2]);
  s = acting('thief'); s.players[0].honor = [4, 4]; s.players[1].honor = [2, 2, 2];
  s = apply(s, 'a', { type: 'act', targetId: 'b', token: 1 }); assert.equal(s.players[0].honor.reduce((a, b) => a + b), 10);
  assert.notEqual(s.phase, 'finished', '10 points is checked only after House Reveal');
  assert.ok(game.view(s, 'c').players[0].house); assert.equal(game.view(s, 'c').players[0].score, null);
});

test('Gravedigger can schedule a later Trickster rank and dead queued cards remain publicly marked', () => {
  let s = acting('gravedigger'); s.discards = [card('judge'), card('spy', 4)];
  s.queue = [{ playerId: 'b', card: card('troublemaker') }];
  s = apply(s, 'a', { type: 'act' });
  s = apply(s, 'a', { type: 'decide', cardId: 'judge', immediate: false, ordered: true });
  assert.equal(s.active.card.role, 'troublemaker'); assert.equal(s.queue[0].card.role, 'judge');
  s.players[0].alive = false;
  s = apply(s, 'b', { type: 'act', targetId: 'c' }); s = apply(s, 'b', { type: 'decide', reveal: false });
  assert.ok(s.players[0].played.some(c => c.role === 'judge' && c.cancelled));
  assert.equal(s.nightPhase, 4);
});

test('past phases cannot be replayed, no-victim attacks continue, and honor awards finish with reserve tokens', () => {
  let s = acting('spy'); s.phase = 'announce'; s.active = null; s.nightPhase = 2; s.players[0].hand = [card('spy', 1)];
  assert.throws(() => apply(s, 'a', { type: 'announce', cardIds: ['spy-1'] }));
  s = acting('blindAssassin'); s.players.slice(1).forEach(p => { p.alive = false; });
  s = apply(s, 'a', { type: 'act' }); assert.equal(s.phase, 'announce'); assert.equal(s.nightPhase, 5);
  s.honorPool = []; s.honorReserve = [4, 3, 2]; s = announceAll(s); assert.equal(s.phase, 'roundEnd');
  assert.equal(s.players[0].honor.length, 1); assert.equal(s.players[2].honor.length, 1);
});

function reveal(s) { s.nightPhase = 5; s.phase = 'announce'; s.active = null; s.pending = null; s.commitments = {}; return announceAll(s); }
test('House Reveal uses next surviving rank, rewards dead allies, and total ties reward only survivors', () => {
  let s = acting('spy'); s.players[0].alive = false;
  s.players[1].house = { house: 'lotus', rank: 2 }; s.players[2].house.rank = 1;
  s = reveal(s); assert.equal(s.roundResult.winningHouse, 'crane');
  assert.deepEqual(s.roundResult.awarded, ['a', 'c']); assert.equal(game.view(s, 'd').players[0].house, null);
  s = acting('spy'); s.players[2].alive = false; s.players[3].alive = false;
  s = reveal(s); assert.equal(s.roundResult.tied, true); assert.deepEqual(s.roundResult.awarded, ['a', 'b']);
  s = acting('spy'); s.players[3].house.rank = 3; s = reveal(s); assert.equal(s.roundResult.winningHouse, 'crane');
});

test('surviving Mastermind overrides rank, Ronin Mastermind blocks house awards, and victory ties are shared', () => {
  let s = acting('spy'); s.players[3].hand = [card('mastermind')]; s = reveal(s);
  assert.equal(s.roundResult.winningHouse, 'lotus');
  s = acting('spy'); s.players[3].hand = [card('mastermind')]; s.players[3].house = { house: 'ronin', rank: null }; s = reveal(s);
  assert.equal(s.roundResult.winningHouse, null); assert.deepEqual(s.roundResult.awarded, ['d']);
  s = acting('spy'); s.players[0].honor = [4, 4]; s.players[2].honor = [4, 4]; s.players[3].house.rank = 3;
  s.honorPool = [2, 2]; s = reveal(s); assert.deepEqual(s.winners, ['a', 'c']); assert.equal(game.result(s).players[0].score, 10);
  assert.throws(() => apply(s, 'a', { type: 'nextRound' }));
});

test('all projections are isolated copies and omit decks, identities, token values and other private intel', () => {
  const s = game.create(ids, {}, rng()), v = game.view(s, 'a'), spectator = game.view(s, 'outsider');
  for (const forbidden of ['unused', 'discards', 'honorPool', 'honorReserve', 'commitments']) assert.equal(v[forbidden], undefined);
  assert.ok(v.players.filter(p => p.id !== 'a').every(p => p.house === null && p.score === null && p.hand.every(c => c === null)));
  assert.deepEqual(spectator.intel, []); assert.deepEqual(spectator.pack, []); assert.ok(spectator.players.every(p => p.score === null));
  v.pack[0].role = 'mutated'; v.reference.spy.text = 'mutated'; assert.notEqual(s.players[0].pack[0].role, 'mutated');
  assert.notEqual(game.view(s, 'b').reference.spy.text, 'mutated');
});

test('one skill keeps its decision deadline and private result labels escape target names', () => {
  let s = acting('spy'); const before = game.turn(s);
  s = apply(s, 'a', { type: 'act', targetId: 'b' }); assert.deepEqual(game.turn(s), before);
  const renderer = createNinjaRenderer(() => {}, () => {});
  const html = renderer.render({ game: game.view(s, 'a'), hostId: 'a', players: ids.map(id => ({ id, name: id === 'b' ? '<img src=x onerror=alert(1)>' : id })) }, { id: 'a' });
  assert.doesNotMatch(html, /<img src=x/); assert.match(html, /&lt;img src=x/);
  renderer.dispose();
});

test('4–11 player AI and timeout play finishes reproducibly from only private views, including restarts', () => {
  for (let count = 4; count <= 11; count++) for (let seed = 1; seed <= 8; seed++) {
    const random = rng(seed), players = Array.from({ length: count }, (_, i) => String(i));
    let s = game.create(players, {}, random), step = 0;
    while (!game.isFinished(s) && step++ < 2000) {
      if (s.phase === 'roundEnd') {
        assert.equal(game.turn(s), null);
        assert.throws(() => game.apply(s, '1', { type: 'nextRound' }, { random, isHost: false }));
        s = game.apply(s, '0', { type: 'nextRound' }, { random, isHost: true }); continue;
      }
      const window = game.turn(s); assert.ok(window?.players.length, `stalled in ${s.phase}`);
      const id = window.players[0], view = game.view(s, id), prior = JSON.stringify(s), viewPrior = JSON.stringify(view);
      const command = seed % 2 ? game.timeout(view, id) : game.bot.decide(view, id, {});
      assert.ok(command, `no command in ${s.phase}`); assert.equal(JSON.stringify(view), viewPrior);
      const next = game.apply(s, id, command, { random, isHost: id === '0' }); assert.equal(JSON.stringify(s), prior);
      s = JSON.parse(JSON.stringify(next));
    }
    assert.equal(s.phase, 'finished'); assert.ok(s.winners.length); assert.ok(game.result(s).players.every(p => Number.isFinite(p.score)));
  }
});

test('renderer escapes names, shows all players, and sends real draft / announce selections', async () => {
  let s = game.create(ids, {}, rng()); const sent = [];
  const renderer = createNinjaRenderer(async command => { sent.push(command); s = apply(s, 'a', command); }, () => {});
  const render = () => renderer.render({ game: game.view(s, 'a'), hostId: 'a', players: ids.map(id => ({ id, name: id === 'a' ? '<Alice>' : id })) }, { id: 'a' });
  const html = render(); assert.match(html, /&lt;Alice&gt;/); assert.equal((html.match(/class="nn-seat /g) ?? []).length, 3);
  await renderer.handle('card', { dataset: { card: s.players[0].pack[0].id } }); await renderer.handle('draft');
  assert.equal(sent[0].type, 'draft'); assert.ok(game.view(s, 'a').players[0].ready);
  render(); renderer.dispose();
});
