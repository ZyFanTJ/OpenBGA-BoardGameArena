import test from 'node:test';
import assert from 'node:assert/strict';
import { cabo } from '../packages/games/cabo/index.js';
import { finalTurnsRemaining, finalRoundBanner } from '../apps/web/games/cabo/call-effect.js';
import { caboResults } from '../apps/web/games/cabo/results.js';

test('last-round counter follows authoritative turns for every caller and table size', () => {
  for (let count = 2; count <= 4; count++) for (let caller = 0; caller < count; caller++) {
    const ids = Array.from({ length: count }, (_, i) => `p${i}`);
    let state = cabo.create(ids, {}, () => .4);
    state.phase = 'turn'; state.turn = caller;
    assert.equal(finalTurnsRemaining(cabo.view(state, ids[0])), 0);
    state = cabo.apply(state, ids[caller], { type: 'cabo' });
    for (let remaining = count - 1; remaining > 0; remaining--) {
      const actor = state.players[state.turn].id;
      assert.equal(finalTurnsRemaining(cabo.view(state, ids[0])), remaining);
      state = cabo.apply(state, actor, { type: 'draw', source: 'deck' });
      assert.equal(finalTurnsRemaining(cabo.view(state, ids[0])), remaining, 'drawing does not finish a turn');
      state = cabo.apply(state, actor, { type: 'discard' });
    }
    assert.equal(state.phase, 'roundEnd');
    assert.equal(finalTurnsRemaining(cabo.view(state, ids[0])), 0);
  }
});

test('last-round status escapes names and is absent after settlement', () => {
  const state = { players: [{ id: 'a' }, { id: 'b' }], caller: 'a', turnId: 'b', phase: 'spy' };
  assert.equal(finalTurnsRemaining(state), 1);
  assert.match(finalRoundBanner(state, () => '<img onerror=x>'), /&lt;img onerror=x&gt;/);
  assert.equal(finalRoundBanner({ ...state, phase: 'roundEnd' }, () => 'A'), '');
});

test('settlement shows all four public final hands and never renders during play', () => {
  const ids = ['a', 'b', 'c', 'd'];
  let state = cabo.create(ids, {}, () => .01);
  for (const id of ids) {
    state = cabo.apply(state, id, { type: 'look', slots: [0, 1] });
    state = cabo.apply(state, id, { type: 'confirm' });
  }
  const name = id => id === 'a' ? '<img onerror=x>' : id;
  assert.equal(caboResults(cabo.view(state, 'a'), name, 'a'), '');
  state = cabo.apply(state, 'a', { type: 'cabo' });
  for (const id of ids.slice(1)) {
    state = cabo.apply(state, id, { type: 'draw', source: 'deck' });
    state = cabo.apply(state, id, { type: 'discard' });
  }
  const view = cabo.view(state, 'a'), html = caboResults(view, name, 'a');
  assert.equal(view.phase, 'roundEnd');
  assert.equal((html.match(/class="playing-card result-card"/g) ?? []).length, 16);
  assert.equal((html.match(/aria-label="最终手牌"/g) ?? []).length, 4);
  assert.match(html, /&lt;img onerror=x&gt;/);
  assert.ok(!html.includes('暗牌'));
});
