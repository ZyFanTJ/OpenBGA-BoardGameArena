import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/server/http.js';
import { JsonStore } from '../packages/platform/store.js';
import { games } from '../packages/games/registry.js';

test('Custom action HTTP lifecycle preserves confirmed stakes across restart and rejects duplicate or forged resolution', async t => {
  let app, base, store = new JsonStore();
  const provider = async input => {
    assert.ok(!JSON.stringify(input).includes('PRIVATE-HTTP'));
    return { source: 'ai', value: input.data.mode === 'narrate' ? { narration: '信使记住了你的善意，旧事从那段小戏展开。' } : {
      choiceId: null, improvisation: { title: '一段小戏', skill: 'performance', difficulty: 'easy', reason: '用表演缓和气氛。',
        success: '信使愿意谈起旧友。', failure: '信使没有接话。', effect: { kind: 'fiction' }, threadId: null,
        hook: { title: '信使的旧友', prompt: '询问信使为何躲着旧友' } },
    } };
  };
  async function start() {
    app = createApp({ store, registry: games, random: () => .95, effectProviders: { 'text-json': provider } });
    await new Promise(r => app.server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${app.server.address().port}`;
  }
  async function stop() { app.closeStreams(); await new Promise(r => app.server.close(r)); }
  await start(); t.after(stop);
  async function req(path, data, cookie) {
    const response = await fetch(base + '/api' + path, { method: data === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, value: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const user = await req('/session', { name: 'Improviser' }), outsider = await req('/session', { name: 'Outside' });
  let room = (await req('/rooms', { gameId: 'dnd', title: '自由行动验证', gameOptions: { adventureId: 'mistlight' } }, user.cookie)).value;
  async function command(data, revision = room.revision) {
    const response = await req(`/rooms/${room.id}/actions`, { revision, ...data }, user.cookie);
    assert.equal(response.status, 200, response.value.error); room = response.value;
  }
  async function settled() {
    for (let i = 0; i < 100; i++) {
      room = (await req(`/rooms/${room.id}`, undefined, user.cookie)).value;
      if (!room.game?.pending) return;
      await new Promise(r => setTimeout(r, 10));
    }
    assert.fail('DM effect failed to settle');
  }
  await command({ type: 'ready', ready: true }); await command({ type: 'start' });
  await command({ type: 'game', command: { type: 'character', archetype: 'fighter', name: '演员', note: 'PRIVATE-HTTP' } }); await settled();
  await command({ type: 'game', command: { type: 'act', text: '我演一出小戏安慰信使' } }); await settled();
  const pending = structuredClone(room.game.pendingCheck), revision = room.revision;
  assert.match(pending.spec.label, /表演/); assert.match(pending.spec.stakes.failure, /没有接话/);
  assert.equal(room.game.story.memories.length, 0); assert.equal(room.game.step, 0);
  assert.equal((await req(`/rooms/${room.id}`, undefined, outsider.cookie)).status, 403);
  const snapshot = JSON.stringify(store.data); await stop();
  store = new JsonStore(); store.transaction(data => Object.assign(data, JSON.parse(snapshot))); await start(); await settled();
  assert.deepEqual(room.game.pendingCheck, pending);
  await command({ type: 'game', command: { type: 'roll' } }, revision); await settled();
  assert.equal(room.game.lastCheck.id, pending.id); assert.equal(room.game.story.memories.length, 1);
  assert.equal(room.game.story.threads[0].status, 'open'); assert.equal(room.game.step, 1);
  assert.equal((await req(`/rooms/${room.id}/actions`, { type: 'game', revision, command: { type: 'roll' } }, user.cookie)).status, 409);
  assert.equal((await req(`/rooms/${room.id}/actions`, { type: 'game', revision: room.revision, command: { type: 'improvisation', hp: 999 } }, user.cookie)).status, 400);
  for (const file of ['story.css', 'story-ui.js']) assert.equal((await fetch(base + '/games/dnd/' + file)).status, 200);
});
