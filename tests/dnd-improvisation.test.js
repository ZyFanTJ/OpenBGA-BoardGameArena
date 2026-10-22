import test from 'node:test';
import assert from 'node:assert/strict';
import { dnd } from '../packages/games/dnd/index.js';
import { createRollPresentation } from '../apps/web/games/dnd/roll-ui.js';
import { adventureView } from '../apps/web/games/dnd/play-ui.js';
const ctx = { random: () => .95 };
const local = { source: 'local', value: null };
function settle(s) { while (s.pending) s = dnd.applyEffect(s, s.pending.id, local, ctx); return s; }
function start(ids = ['a'], pack = 'mistlight') {
  let s = dnd.create(ids, { adventureId: pack });
  for (const id of ids) s = dnd.apply(s, id, { type: 'character', archetype: 'wizard', name: id, note: `PRIVATE-${id}` }, ctx);
  return settle(s);
}
function proposal(overrides = {}) {
  return { title: '用一段滑稽戏缓和气氛', skill: 'performance', difficulty: 'easy', reason: '用表演吸引注意。',
    success: '艾禾笑了，愿意聊起她记得的旧事。', failure: '艾禾没有笑，提醒你时间紧迫。', effect: { kind: 'fiction' }, threadId: null, hook: null, ...overrides };
}
function judge(s, improvisation, intent = '我用矿工的口音演一段滑稽戏', id = dnd.turn(s).players[0]) {
  const pending = dnd.apply(s, id, { type: 'act', text: intent }, ctx);
  return dnd.applyEffect(pending, pending.pending.id, { source: 'ai', value: { choiceId: null, improvisation } }, ctx);
}
const roll = (s, random = ctx.random) => settle(dnd.apply(s, s.pendingCheck.playerId, { type: 'roll' }, { random }));
const freeze = x => { if (x && typeof x === 'object') { Object.freeze(x); Object.values(x).forEach(freeze); } return x; };

test('Novel actions have their own skill check, actual consequences and durable memories rather than button aliases', () => {
  const before = start(), original = JSON.stringify(before), pending = judge(freeze(before), proposal());
  assert.equal(JSON.stringify(before), original); assert.equal(pending.step, 0); assert.equal(pending.story.beats.length, 0);
  const spec = dnd.view(pending, 'a').pendingCheck.spec;
  assert.equal(spec.target, 10); assert.equal(spec.bonus, 0); assert.match(spec.label, /魅力（表演）/);
  assert.match(spec.stakes.failure, /没有笑/); assert.match(spec.consequence, /不直接改变生命/);
  const next = roll(pending);
  assert.equal(next.scene, 'village'); assert.equal(next.step, 1); assert.deepEqual(next.clues, []);
  assert.equal(next.story.beats[0].intent, '我用矿工的口音演一段滑稽戏');
  assert.match(next.story.beats[0].detail, /愿意聊起/); assert.equal(next.players[0].character.potions, 1);
  const follow = dnd.apply(next, 'a', { type: 'act', text: '她提起了什么旧事？' }, ctx);
  assert.match(JSON.stringify(dnd.effect(follow).input.data.story), /愿意聊起/);
});

test('A creative approach can solve an authored obstacle using a different skill, with its server-owned DC and outcome', () => {
  let s = start();
  s = judge(s, proposal({ difficulty: 'hard', effect: { kind: 'approach', choiceId: 'talk' } }));
  assert.equal(dnd.view(s, 'a').pendingCheck.spec.target, 10); // The obstacle, not a model-provided DC.
  s = roll(s); assert.ok(s.clues.includes('password')); assert.ok(s.attempted.includes('village:talk'));
  assert.equal(s.story.beats.length, 1); assert.equal(s.step, 1);
  assert.throws(() => dnd.apply(s, 'a', { type: 'choose', choiceId: 'talk' }, ctx));
  let failed = start('a'.split(''), 'blackapple'); failed.scene = 'banquet'; failed.visited.push('banquet');
  const target = dnd.view(failed, 'a').choices.find(x => x.id.startsWith('talk') && x.check);
  assert.ok(target);
  failed = roll(judge(failed, proposal({ effect: { kind: 'approach', choiceId: target.id } })), () => 0);
  assert.equal(failed.flags.alarm, true); // Authored failure consequences still apply.
});

test('Creative preparation gives the whole party one real advantage; it is visible and consumed by a matching check', () => {
  let s = roll(judge(start(['a', 'b']), proposal({ effect: { kind: 'influence', skill: 'investigation' } })));
  assert.equal(s.players[s.cursor].id, 'b');
  const spec = dnd.view(s, 'b').choices.find(x => x.id === 'investigate').check;
  assert.equal(spec.mode, 'advantage'); assert.equal(spec.count, 2); assert.match(spec.circumstance, /艾禾/);
  s = dnd.apply(s, 'b', { type: 'choose', choiceId: 'investigate' }, ctx);
  const values = [0, .95]; s = settle(dnd.apply(s, 'b', { type: 'roll' }, { random: () => values.shift() }));
  assert.deepEqual(s.lastCheck.event.roll.dice, [1, 20]); assert.equal(s.lastCheck.event.roll.total, 25);
  assert.equal(s.story.edges.length, 0); assert.ok(s.clues.includes('waterway'));
});

test('Failed preparation causes disadvantage; cancelling preserves it and saved rolls never draw twice', () => {
  let s = roll(judge(start(), proposal({ effect: { kind: 'influence', skill: 'investigation' } })), () => 0);
  assert.equal(s.story.edges[0].mode, 'disadvantage'); assert.equal(s.story.beats[0].success, false);
  s = dnd.apply(s, 'a', { type: 'choose', choiceId: 'investigate' }, ctx);
  assert.equal(dnd.view(s, 'a').pendingCheck.spec.mode, 'disadvantage');
  const step = s.step;
  s = dnd.apply(s, 'a', { type: 'cancelCheck' }, { random: () => assert.fail('Cancellation cannot draw') });
  assert.equal(s.story.edges.length, 1); assert.equal(s.step, step);
  s = dnd.apply(s, 'a', { type: 'choose', choiceId: 'investigate' }, ctx);
  const values = [.95, 0]; s = settle(dnd.apply(s, 'a', { type: 'roll' }, { random: () => values.shift() }));
  assert.equal(s.lastCheck.event.roll.total, 6); assert.equal(s.story.edges.length, 0);
  assert.throws(() => dnd.apply(s, 'a', { type: 'roll' }, ctx));
});

test('Player-created side stories persist, provide follow-up choices and resolve only on success', () => {
  let s = roll(judge(start(), proposal({ hook: { title: '信使的旧友', prompt: '问艾禾为何多年不敢与旧友重逢' } })));
  const thread = s.story.threads[0]; assert.equal(thread.status, 'open');
  const v = dnd.view(s, 'a'); assert.ok(v.choices.some(x => x.id === `story:${thread.id}`));
  const pending = dnd.apply(s, 'a', { type: 'choose', choiceId: `story:${thread.id}` }, ctx);
  assert.equal(dnd.effect(pending).input.data.followingThread, thread.id); assert.match(pending.pending.text, /重逢/);
  s = settle(dnd.applyEffect(pending, pending.pending.id, { source: 'ai', value: { choiceId: null, improvisation: proposal({ threadId: thread.id }) } }, ctx));
  s = roll(s, () => 0); assert.equal(s.story.threads[0].status, 'open');
  s = roll(judge(s, proposal({ threadId: thread.id, success: '她答应与旧友和解。' })));
  assert.equal(s.story.threads[0].status, 'resolved');
  assert.ok(!dnd.view(s, 'a').choices.some(x => x.id === `story:${thread.id}`));
});

test('Harmless roleplay can establish a public fact without an unnecessary roll or consuming a turn', () => {
  const before = start(['a', 'b']), after = settle(judge(before, proposal({ skill: null, success: '艾禾记住了你教她的家乡问候。' })));
  assert.equal(after.pendingCheck, null); assert.equal(after.step, before.step); assert.equal(after.cursor, before.cursor);
  assert.match(dnd.view(after, 'b').story.memories[0].detail, /家乡问候/);
  assert.ok(!JSON.stringify(dnd.view(after, 'b')).includes('PRIVATE-a'));
});

test('NPC conversations remain in future model context even when no skill check or formal side story is proposed', () => {
  const initial = dnd.apply(start(), 'a', { type: 'act', text: '猪倌，你有什么烦心事？' }, ctx);
  const s = dnd.applyEffect(initial, initial.pending.id, { source: 'ai', value: { choiceId: null, reply: '我的小母猪回来后再也不认得我了。' } }, ctx);
  assert.equal(s.step, 0); assert.equal(s.story.beats[0].type, 'conversation');
  const next = dnd.apply(s, 'a', { type: 'act', text: '那头猪叫什么名字？' }, ctx);
  assert.match(JSON.stringify(dnd.effect(next).input.data.story), /小母猪/);
});

test('Circumstance disadvantage cancels a clue advantage consistently in both preview and actual dice', () => {
  let s = start(); s.scene = 'gate'; s.clues.push('password');
  s.story.edges.push({ sceneId: 'gate', skill: 'persuasion', mode: 'disadvantage', reason: '守矿人对你的恶作剧仍有戒心。' });
  assert.equal(dnd.view(s, 'a').choices.find(x => x.id === 'talk').check.mode, 'normal');
  s = dnd.apply(s, 'a', { type: 'choose', choiceId: 'talk' }, ctx);
  let draws = 0; s = roll(s, () => { draws++; return .95; });
  assert.equal(s.lastCheck.event.roll.mode, 'normal'); assert.equal(draws, 1); assert.equal(s.story.edges.length, 0);
});

test('Combat improvisation consumes the action and enemy turns, with bounded one-use attack circumstances', () => {
  let s = start(); s.scene = 'trail'; s.phase = 'combat';
  s.combat = { key: 'wolves', enemies: [{ id: 'enemy-0', name: '雾径狼', hp: 90, maxHp: 90, ac: 10, dex: 0, attack: 0, die: 4, bonus: 0 }], order: ['a', 'enemy-0'], cursor: 0, round: 1, initiative: [] };
  s = roll(judge(s, proposal({ skill: 'stealth', effect: { kind: 'influence', skill: 'attack' }, success: '狼群被诱饵引开了视线。' })), () => .8);
  assert.equal(s.step, 1); assert.equal(s.combat.round, 2); assert.ok(s.journal.some(x => x.text.includes('雾径狼 攻击')));
  assert.equal(dnd.view(s, 'a').choices.find(x => x.id === 'attack:enemy-0').check.mode, 'advantage');
  s = dnd.apply(s, 'a', { type: 'choose', choiceId: 'attack:enemy-0' }, ctx); s = roll(s);
  assert.equal(s.lastCheck.event.roll.mode, 'advantage'); assert.equal(s.story.edges.length, 0);
});

test('Malformed or illegal custom proposals never grant state, bypass prerequisites, roll or spend a turn', () => {
  const s = dnd.apply(start(), 'a', { type: 'act', text: '尝试不同的办法' }, ctx);
  for (const bad of [
    proposal({ hp: 999 }), proposal({ skill: '__proto__' }), proposal({ difficulty: 'trivial' }), proposal({ dc: 1 }),
    proposal({ effect: { kind: 'win' } }), proposal({ effect: { kind: 'fiction', items: ['神器'] } }),
    proposal({ effect: { kind: 'approach', choiceId: 'waterway' } }), proposal({ effect: { kind: 'approach', choiceId: 'travel' } }),
    proposal({ threadId: 'made-up' }), proposal({ hook: { title: '', prompt: '坏' } }), proposal({ skill: null, effect: { kind: 'influence', skill: 'attack' } }),
  ]) {
    const next = dnd.applyEffect(freeze(s), s.pending.id, { source: 'ai', value: { choiceId: null, improvisation: bad } }, { random: () => assert.fail('Invalid proposals cannot roll') });
    assert.equal(next.step, 0); assert.equal(next.pendingCheck, null); assert.equal(next.story.beats.length, 0); assert.equal(next.dmStatus, 'fallback');
    assert.equal(next.players[0].character.hp, 7); assert.equal(next.outcome, null);
  }
});

test('V3 migration preserves chosen adventure, flags and locked rolls; improvised rolls survive serialization', () => {
  let old = start(['a'], 'blackapple'); old.flags.alarm = true;
  old = dnd.apply(old, 'a', { type: 'choose', choiceId: dnd.view(old, 'a').choices.find(x => x.check)?.id }, ctx);
  delete old.story; const before = JSON.stringify(old), migrated = dnd.migrate(freeze(old), 3);
  assert.equal(JSON.stringify(old), before); assert.equal(migrated.options.adventureId, 'blackapple'); assert.equal(migrated.flags.alarm, true);
  assert.deepEqual(migrated.pendingCheck, old.pendingCheck); assert.equal(migrated.story.beats.length, 0);
  const pending = judge(start(), proposal()), saved = JSON.parse(JSON.stringify(pending));
  assert.deepEqual(dnd.view(saved, 'a').pendingCheck, dnd.view(pending, 'a').pendingCheck);
  assert.equal(roll(saved).lastCheck.spec.title, proposal().title);
});

test('Public story and model context exclude private backgrounds, future rooms and internal proposal state', () => {
  let s = judge(start(['a', 'b'], 'blackapple'), proposal());
  const v = dnd.view(s, 'b'); assert.ok(!JSON.stringify(v).includes('PRIVATE-a')); assert.ok(!JSON.stringify(v).includes('improvisation'));
  s = roll(s); s = dnd.apply(s, 'b', { type: 'act', text: '我想认识村里的人' }, ctx);
  const input = dnd.effect(s).input;
  for (const secret of ['PRIVATE-', '蓝色温室', 'hallGuard']) assert.ok(!JSON.stringify(input).includes(secret));
  assert.match(input.system, /主线是目标/); assert.match(input.system, /新办法/);
});

test('Custom check interface shows stakes, modifiers and consequences; stories live in an optional panel', () => {
  const pending = judge(start(), proposal({ title: '<演一出戏>' })), v = dnd.view(pending, 'a');
  const html = createRollPresentation(() => {}).html(v, 'a', false);
  assert.match(html, /&lt;演一出戏&gt;/); assert.match(html, /成功/); assert.match(html, /失败/); assert.match(html, /表演未受训/);
  const s = roll(pending), view = dnd.view(s, 'a');
  const panel = adventureView(view, { hostId: 'a' }, { id: 'a' }, { panel: 'story', focus: '', draft: '', narration: '' }, '');
  assert.match(panel, /愿意聊起/); assert.ok(!panel.includes('undefined')); assert.ok(!panel.includes('style='));
});
