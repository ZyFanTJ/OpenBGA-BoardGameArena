import test from 'node:test';
import assert from 'node:assert/strict';
import { createNarrationPresentation } from '../apps/web/games/dnd/narration-ui.js';

test('Narration buffers real partial text, keeps the reveal position on final commit and respects reduced motion', () => {
  let clock = 0, callback, cancelled = 0;
  const node = { textContent: '', scrollHeight: 50, scrollTop: 0, clientHeight: 50, classList: { toggle() {} }, setAttribute() {} };
  const presentation = createNarrationPresentation({ now: () => clock, requestFrame: fn => { callback = fn; return 1; }, cancelFrame: () => { cancelled++; }, reducedMotion: () => false });
  const scene = { scene: { id: 'village', description: '静静的镇子。' }, journal: [] };
  presentation.observe(scene); presentation.mount({ querySelector: () => node });
  assert.equal(node.textContent, '静静的镇子。');
  const prefix = '雾灯🌙在夜风里摇曳，门后响起轻轻的脚步声。';
  presentation.observe({ ...scene, narrationStream: { id: 'dm-1', text: prefix } });
  assert.equal(node.textContent, '');
  clock = 80; callback(clock);
  assert.ok(node.textContent.length > 0 && node.textContent.length < prefix.length);
  const partial = node.textContent;
  const final = prefix + '你们的旅程即将开始。';
  presentation.observe({ ...scene, journal: [{ id: 2, kind: 'dm', text: final }] });
  assert.equal(node.textContent, partial); // Final persistence must not flash the entire remainder.
  for (let i = 0; i < 40; i++) { clock += 80; callback(clock); }
  assert.equal(node.textContent, final);
  presentation.observe({ ...scene, narrationStream: { id: 'dm-2', text: '临时片段' } });
  presentation.observe({ ...scene, journal: [{ id: 3, kind: 'dm', text: '连接中断后的完整本地叙述。' }] });
  assert.equal(node.textContent, '连接中断后的完整本地叙述。');
  presentation.dispose(); assert.ok(cancelled > 0);
  const reduced = createNarrationPresentation({ reducedMotion: () => true });
  reduced.observe({ ...scene, narrationStream: { id: 'dm-3', text: prefix } });
  assert.equal(reduced.text(), prefix); reduced.dispose();
});
