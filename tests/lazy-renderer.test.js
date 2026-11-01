import test from 'node:test';
import assert from 'node:assert/strict';
import {lazyRenderer} from '../apps/web/games/lazy.js';

const settle = () => new Promise(resolve => setImmediate(resolve));

test('a game renderer loads only when needed, displays its latest snapshot and forwards actions', async () => {
  let loads = 0, renders = 0, observed, command, disposed = 0, overlays = 0, restored = 0, reset = false;
  const factory = lazyRenderer(async () => {
    loads++;
    return send => ({update: (container, snapshot, user, options) => { reset = !!options?.resetAnimations; observed = snapshot; container.innerHTML = 'ready'; }, handle: action => send(action), beforeOverlay: () => overlays++, afterOverlay: () => restored++, dispose: () => disposed++});
  });
  const ui = factory(value => { command = value; }, () => { renders++; });
  const container = {innerHTML: ''}; assert.equal(loads, 0);
  ui.beforeOverlay();assert.equal(overlays,0);
  ui.afterOverlay();assert.equal(restored,0);
  ui.update(container, {revision: 1}, {}); assert.match(container.innerHTML, /正在铺好牌桌/);
  ui.update(container, {revision: 2}, {}); assert.equal(loads, 1);
  await settle(); assert.equal(renders, 1);
  ui.update(container, {revision: 3}, {}, {resetAnimations:true}); assert.equal(observed.revision, 3); assert.equal(container.innerHTML, 'ready'); assert.equal(reset,true);
  ui.beforeOverlay();assert.equal(overlays,1);
  ui.afterOverlay();assert.equal(restored,1);
  ui.handle('play'); assert.equal(command, 'play'); ui.dispose(); assert.equal(disposed, 1);
  const next = factory(() => {}, () => {}); next.update(container, {revision: 4}, {});
  assert.equal(container.innerHTML, 'ready'); assert.equal(loads, 1);
});

test('leaving during import cannot redraw a different page; a later room reuses the import', async () => {
  let resolveImport, oldRenders = 0, newRenders = 0, loads = 0;
  const factory = lazyRenderer(() => { loads++; return new Promise(resolve => { resolveImport = resolve; }); });
  const old = factory(() => {}, () => oldRenders++), next = factory(() => {}, () => newRenders++), container = {};
  old.update(container, {}, {}); old.dispose(); next.update(container, {}, {});
  resolveImport(() => ({update: target => { target.innerHTML = 'new table'; }})); await settle();
  assert.equal(oldRenders, 0); assert.equal(newRenders, 1); assert.equal(loads, 1);
  next.update(container, {}, {}); assert.equal(container.innerHTML, 'new table');
});

test('a failed import can be retried without losing the room or caching the failure', async () => {
  let loads = 0, redraws = 0;
  const factory = lazyRenderer(async () => { if (++loads === 1) throw new Error('offline'); return () => ({render: () => 'recovered'}); });
  const ui = factory(() => {}, () => redraws++), container = {};
  ui.update(container, {}, {}); await settle(); ui.update(container, {}, {}); assert.match(container.innerHTML, /重试/);
  ui.handle('retryRenderer'); ui.update(container, {}, {}); await settle(); ui.update(container, {}, {});
  assert.equal(loads, 2); assert.equal(container.innerHTML, 'recovered'); assert.equal(redraws, 3);
});
