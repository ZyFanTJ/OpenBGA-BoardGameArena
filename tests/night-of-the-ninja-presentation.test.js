import test from 'node:test';
import assert from 'node:assert/strict';
import { nightOfTheNinja as game } from '../packages/games/night-of-the-ninja/index.js';
import { ninjaDeck } from '../packages/games/night-of-the-ninja/cards.js';
import { ninjaCues, currentNinjaAction, describeNinjaAction } from '../apps/web/games/night-of-the-ninja/presentation.js';
import { createNinjaAnimator } from '../apps/web/games/night-of-the-ninja/motion.js';

const card = id => ninjaDeck().find(c => c.id === id);
function acting(id = 'spy-1') {
  const s = game.create(['a', 'b', 'c', 'd'], {}, () => .3);
  s.phase = 'act'; s.nightPhase = id.startsWith('blindAssassin') ? 4 : 1;
  s.players.forEach(p => { p.hand = []; p.played = []; });
  s.active = { playerId: 'a', card: card(id) }; s.players[0].played = [card(id)];
  return s;
}
const apply = (s, id, command) => game.apply(s, id, command, { random: () => .3 });

test('public feedback identifies the actor, card and target without showing private spy results', () => {
  const state = acting(), next = apply(state, 'a', { type: 'act', targetId: 'b' });
  const mine = ninjaCues(game.view(state, 'a'), game.view(next, 'a'));
  const peer = ninjaCues(game.view(state, 'c'), game.view(next, 'c'));
  assert.deepEqual(mine, peer); assert.equal(mine[0].kind, 'ability');
  assert.equal(mine[0].card.id, 'spy-1'); assert.deepEqual(mine[0].targetIds, ['b']);
  assert.doesNotMatch(JSON.stringify(mine), /house|intel|honor|pack/);
  const text = describeNinjaAction(mine[0], game.view(next, 'a'), id => `玩家${id}`);
  assert.equal(text.title, '玩家a → 玩家b'); assert.match(text.detail, /仅行动者可见/);
});

test('consecutive identical public events and the capped activity log still produce one new action', () => {
  const before = game.view(acting(), 'c'), event = { type: 'ability', actorId: 'a', targetId: 'b', role: 'spy' };
  before.log = [event]; const next = structuredClone(before); next.log.push({ ...event }); next.sequence++;
  assert.equal(ninjaCues(before, next).filter(c => c.kind === 'ability').length, 1);
  before.log = Array.from({ length: 30 }, (_, i) => ({ ...event, targetId: String(i) }));
  next.log = [...before.log.slice(1), { ...event, targetId: 'new-target' }];
  const cues = ninjaCues(before, next); assert.equal(cues.length, 1); assert.deepEqual(cues[0].targetIds, ['new-target']);
});

test('a reaction is shown before the next played card, and death / reflection text is explicit', () => {
  let s = acting('blindAssassin-1'); s.queue = [{ playerId: 'c', card: card('blindAssassin-2') }];
  s = apply(s, 'a', { type: 'act', targetId: 'b' }); const before = game.view(s, 'd');
  const next = game.view(apply(s, 'b', { type: 'decide', choice: 'accept' }), 'd');
  const cues = ninjaCues(before, next);
  assert.deepEqual(cues.map(c => c.kind), ['reaction', 'play']); assert.equal(cues[1].card.id, 'blindAssassin-2');
  assert.match(describeNinjaAction(cues[0], next, id => id).title, /b 已阵亡/);
  const mirror = describeNinjaAction({ kind: 'reaction', actorId: 'b', targetIds: ['a'], choice: 'mirrorMonk' }, next, id => id);
  assert.match(mirror.title, /b 反杀 a/); assert.equal(mirror.tone, 'mirror');
});

test('a secret Shapeshifter choice cannot be inferred from the presentation', () => {
  const s = acting(); s.nightPhase = 3; s.active.card = card('shapeshifter'); s.players[0].played = [card('shapeshifter')];
  const pending = apply(s, 'a', { type: 'act', targetIds: ['b', 'c'] });
  const swapped = apply(pending, 'a', { type: 'decide', swap: true });
  const kept = apply(pending, 'a', { type: 'decide', swap: false });
  for (const viewer of ['a', 'b', 'd']) {
    assert.deepEqual(ninjaCues(game.view(pending, viewer), game.view(swapped, viewer)), ninjaCues(game.view(pending, viewer), game.view(kept, viewer)));
    const cue = currentNinjaAction(game.view(pending, viewer));
    assert.deepEqual(cue.targetIds, []); assert.equal(cue.role, 'shapeshifter');
  }
});

test('animation queue preserves rapid actions, ignores chat replays, and releases controls when disposed', async () => {
  const originals = { window: globalThis.window, document: globalThis.document, matchMedia: globalThis.matchMedia };
  const gates = [], draws = [];
  function node() {
    return { classList: { add() {}, remove() {} }, animate() {
      let finish; const finished = new Promise(resolve => { finish = resolve; }); const animation = { finished, cancel: finish };
      gates.push(finish); return animation;
    } };
  }
  const spotlight = node(), stage = node(), inputs = { inert: false }, target = { querySelector: selector => selector === '.nn-stage' ? stage : selector === '.nn-spotlight' ? spotlight : null,
    querySelectorAll: selector => selector === '.nn-controls,.nn-hand' ? [inputs] : [], setAttribute() {}, removeAttribute() {} };
  globalThis.window = new EventTarget(); globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  globalThis.matchMedia = () => Object.assign(new EventTarget(), { matches: true });
  const animator = createNinjaAnimator((container, snapshot, me, cue) => draws.push({ revision: snapshot.revision, cue: cue?.kind }));
  const flush = () => new Promise(resolve => setImmediate(resolve));
  try {
    const initial = game.view(acting(), 'c'), one = structuredClone(initial), two = structuredClone(initial);
    one.sequence = 1; one.log = [{ type: 'ability', actorId: 'a', targetId: 'b', role: 'spy' }];
    two.sequence = 2; two.log = one.log; two.active = { playerId: 'b', card: card('spy-2') };
    animator.update(target, { game: initial, revision: 0 }, { id: 'c' });
    animator.update(target, { game: one, revision: 1 }, { id: 'c' });
    animator.update(target, { game: two, revision: 2 }, { id: 'c' });
    animator.update(target, { game: two, revision: 3, chat: [{ text: 'hello' }] }, { id: 'c' });
    assert.equal(animator.busy, true); assert.equal(inputs.inert, true);
    for (let i = 0; i < 5; i++) { gates.splice(0).forEach(finish => finish()); await flush(); }
    assert.deepEqual(draws.filter(d => d.cue).map(d => d.cue), ['ability', 'play']);
    assert.equal(draws.at(-1).revision, 3); assert.equal(inputs.inert, false); assert.equal(animator.busy, false);
    animator.update(target, { game: { ...two, sequence: 3, active: { playerId: 'd', card: card('spy-3') } }, revision: 4 }, { id: 'c' });
    animator.dispose(); await flush(); assert.equal(inputs.inert, false);
    const count = draws.length; animator.update(target, { game: one, revision: 10 }, { id: 'c' }); assert.equal(draws.length, count);
  } finally {
    animator.dispose(); Object.assign(globalThis, originals);
  }
});
