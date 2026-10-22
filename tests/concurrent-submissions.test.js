import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../packages/platform/sqlite-store.js';
import { RoomService } from '../packages/platform/rooms.js';
import { SessionService } from '../packages/platform/sessions.js';
import { games } from '../packages/games/registry.js';

function table(t, gameId, count, options = {}) {
  const store = new SqliteStore(); t.after(() => store.close());
  const sessions = new SessionService(store), rooms = new RoomService(store, games, { random: () => .42 });
  const users = Array.from({ length: count }, (_, i) => sessions.create(`玩家${i}`).user);
  let room = rooms.createRoom(users[0], { gameId, title: '同时操作', turnSeconds: 0, options });
  for (const user of users.slice(1)) room = rooms.join(user, room.id);
  for (const user of users) room = rooms.mutate(user, room.id, { type: 'ready', ready: true, revision: room.revision });
  room = rooms.mutate(users[0], room.id, { type: 'start', revision: room.revision });
  const input = (view, command) => ({ type: 'game', revision: view.revision, matchId: view.matchId, submissionKey: view.submissionKey, command });
  return { store, rooms, room, users, input };
}

test('same-window seven wonders choices all commit from one revision; duplicate, sequential, wrong match and later-window actions remain rejected', t => {
  const f = table(t, 'seven-wonders', 3, { side: 'day' }), views = f.users.map(u => f.rooms.snapshot(f.room.id, u));
  const commands = views.map(v => f.input(v, { type: 'choose', action: 'sell', cardId: v.game.hand[0].id, epoch: v.game.epoch }));
  f.rooms.mutate(f.users[0], f.room.id, commands[0]);
  assert.throws(() => f.rooms.mutate(f.users[0], f.room.id, commands[0]), { status: 409 });
  assert.throws(() => f.rooms.mutate(f.users[1], f.room.id, { ...commands[1], matchId: 'old-match' }), { status: 409 });
  assert.throws(() => f.rooms.mutate(f.users[1], f.room.id, { ...commands[1], type: 'leave' }), { status: 409 });
  f.rooms.mutate(f.users[1], f.room.id, commands[1]);
  const last = f.rooms.mutate(f.users[2], f.room.id, commands[2]);
  assert.ok(last.game.epoch > views[0].game.epoch);
  assert.throws(() => f.rooms.mutate(f.users[0], f.room.id, commands[0]), { status: 409 });
  const before = JSON.stringify(f.store.data);
  assert.throws(() => f.rooms.mutate(f.users[0], f.room.id, { ...commands[0], revision: last.revision + 1 }), { status: 409 });
  assert.equal(JSON.stringify(f.store.data), before);
});

test('ninja draft submissions rebase only within their original draft step and preserve other hands', t => {
  const f = table(t, 'night-of-the-ninja', 4), views = f.users.map(u => f.rooms.snapshot(f.room.id, u));
  const commands = views.map(v => f.input(v, { type: 'draft', cardId: v.game.pack[0].id }));
  for (let i = 0; i < f.users.length; i++) f.rooms.mutate(f.users[i], f.room.id, commands[i]);
  assert.throws(() => f.rooms.mutate(f.users[0], f.room.id, commands[0]), { status: 409 });
});

test('DND character creation accepts independent players without relaxing later sequential actions', t => {
  const f = table(t, 'dnd', 2), views = f.users.map(u => f.rooms.snapshot(f.room.id, u));
  const commands = views.map((v, i) => f.input(v, { type: 'character', archetype: 'fighter', name: `旅人${i}`, note: `私密${i}` }));
  f.rooms.mutate(f.users[0], f.room.id, commands[0]);
  const result = f.rooms.mutate(f.users[1], f.room.id, commands[1]);
  assert.equal(result.game.phase, 'exploration');
  assert.ok(!JSON.stringify(result).includes('私密0'));
  assert.throws(() => f.rooms.mutate(f.users[1], f.room.id, commands[1]), { status: 409 });
});
