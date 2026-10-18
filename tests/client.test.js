import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaboRenderer } from '../apps/web/games/cabo.js';
import { cabo } from '../packages/games/cabo/index.js';
import { seatPositions, cardArt } from '../apps/web/games/cabo-cards.js';

test('every player sees their own seat south with clockwise opponents', () => {
  for (let count = 2; count <= 4; count++) {
    const players = Array.from({ length: count }, (_, id) => ({ id: String(id) }));
    for (const viewer of players) {
      const seats = seatPositions(players, viewer.id);
      assert.equal(seats.find(s => s.player.id === viewer.id).position, 'south');
      assert.equal(new Set(seats.map(s => s.position)).size, count);
      assert.equal(seats[(Number(viewer.id) + 1) % count].position, count === 2 ? 'north' : 'west');
    }
  }
});

test('hidden cards use one shared back and no face-value label', () => {
  assert.match(cardArt(null), /tile-14/);
  assert.doesNotMatch(cardArt(null), /card-number|card-ability/);
  assert.match(cardArt(0), /tile-0/);
  assert.match(cardArt(12), /SWAP/);
  assert.doesNotMatch(cardArt(13), /SWAP/);
});

test('renderer selections and CABO button drive the real engine through a round', async () => {
  // The only DOM query reads the optional left/right-end selector.
  globalThis.document = { querySelector: () => null };
  try {
    let state = cabo.create(['a', 'b'], {}, () => .25);
    const user = { id: 'a' };
    let sent = 0;
    const renderer = createCaboRenderer(async command => {
      sent++; state = cabo.apply(state, 'a', command, { isHost: true });
    }, () => {});
    const render = () => renderer.render({ game: cabo.view(state, 'a'), hostId: 'a',
      players: [{ id: 'a', name: '<Alice>' }, { id: 'b', name: 'Bob' }] }, user);
    assert.match(render(), /&lt;Alice&gt;/);
    for (const slot of [0, 1]) await renderer.handle('card', { dataset: { player: 'a', slot: String(slot) } });
    await renderer.handle('look'); render(); await renderer.handle('confirm');
    state = cabo.apply(state, 'b', { type: 'look', slots: [0, 1] });
    state = cabo.apply(state, 'b', { type: 'confirm' });
    state.turn = 0; render();
    await renderer.handle('cabo');
    assert.equal(sent, 3); assert.equal(state.caller, 'a'); assert.equal(state.turn, 1);
    state = cabo.apply(state, 'b', { type: 'draw', source: 'deck' });
    state = cabo.apply(state, 'b', { type: 'discard' });
    assert.equal(state.phase, 'roundEnd');
    const html = render(); assert.match(html, /本轮得分/); assert.doesNotMatch(html, />私密</);
  } finally { delete globalThis.document; }
});
