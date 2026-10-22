import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { SqliteStore } from '../packages/platform/sqlite-store.js';
import { JsonStore } from '../packages/platform/store.js';
import { SessionService } from '../packages/platform/sessions.js';
import { RoomService } from '../packages/platform/rooms.js';
import { games, createRegistry } from '../packages/games/registry.js';
import { createProviderSecrets } from '../apps/server/provider-settings.js';

function workspace(t, beforeCleanup = () => {}) {
  mkdirSync('work', { recursive: true });
  const dir = mkdtempSync(resolve('work/sqlite-tests-'));
  t.after(() => { beforeCleanup(); rmSync(dir, { recursive: true, force: true }); }); return dir;
}

test('SQLite imports legacy JSON and its encryption key once, preserving sessions and live private game state', t => {
  const dir = workspace(t), legacyFile = join(dir, 'platform.json'), file = `${legacyFile}.sqlite`;
  const original = new JsonStore(legacyFile), sessions = new SessionService(original), a = sessions.create('甲');
  const rooms = new RoomService(original, games), room = rooms.createRoom(a.user, { gameId: 'cabo', title: '保留牌桌' });
  const encrypted = createProviderSecrets(original).seal('migration-test-only');
  original.transaction(data => { data.integrations.textProvider.encryptedKey = encrypted; });
  const before = readFileSync(legacyFile, 'utf8'), key = readFileSync(`${legacyFile}.secrets.key`);
  let store = new SqliteStore(file, { legacyFile });
  assert.deepEqual(store.data, original.data);
  assert.equal(createProviderSecrets(store).open(encrypted), 'migration-test-only');
  assert.deepEqual(readFileSync(`${legacyFile}.secrets.key`), key);
  assert.equal(new SessionService(store).authenticate(a.token).id, a.user.id);
  new RoomService(store, games).mutate(a.user, room.id, { type: 'ready', ready: true, revision: room.revision });
  store.close(); store = new SqliteStore(file, { legacyFile });
  assert.equal(store.data.rooms[room.id].players[0].ready, true);
  assert.equal(readFileSync(legacyFile, 'utf8'), before);
  assert.equal(createProviderSecrets(store).open(encrypted), 'migration-test-only'); store.close();
});

test('SQLite rolls back nested mutations, deletion and replacements on domain or persistence failures', t => {
  let store; store = new SqliteStore(join(workspace(t, () => store?.close()), 'data.sqlite'));
  const a = new SessionService(store).create('甲').user;
  const before = structuredClone(store.data);
  assert.throws(() => store.transaction(data => {
    data.profiles[a.id].inventory.push('forged'); delete data.sessions[Object.keys(data.sessions)[0]];
    data.rooms = {}; data.forum.nextNumber++; throw new Error('rollback');
  }), /rollback/);
  assert.deepEqual(store.data, before);
  const persist = store.persist;
  store.persist = () => { throw new Error('disk failure'); };
  assert.throws(() => store.transaction(data => { data.profiles[a.id].name = '未提交'; }), /disk failure/);
  assert.deepEqual(store.data, before); store.persist = persist;
  assert.throws(() => store.transaction(async () => {}), /synchronous/);
  assert.throws(() => store.transaction(() => store.transaction(() => {})), /Nested/);
});

test('SQLite room-sized transactions neither clone nor persist unrelated history and no-op transactions do not write', t => {
  const store = new SqliteStore(); t.after(() => store.close());
  store.transaction(data => {
    data.rooms.ABCD1234 = { revision: 0, chat: [] };
    data.matches.unrelated = { content: 'x'.repeat(1024 * 1024) };
  });
  const history = store.data.matches.unrelated, matches = store.data.matches;
  const writes = [], persist = store.persist.bind(store);
  store.persist = changes => { writes.push(changes.map(({collection,key}) => `${collection}:${key}`)); persist(changes); };
  store.transaction(data => { data.rooms.ABCD1234.revision++; });
  assert.deepEqual(writes.at(-1), ['rooms:ABCD1234']);
  assert.equal(store.data.matches, matches); assert.equal(store.data.matches.unrelated, history);
  store.transaction(data => {
    assert.equal(data.rooms.ABCD1234.revision, 1);
    assert.equal(Object.hasOwn(data, 'missing'), false);
    assert.equal(Object.hasOwn(data.rooms, 'missing'), false);
  });
  assert.deepEqual(writes.at(-1), []);
  store.transaction(data => { delete data.rooms.ABCD1234; });
  assert.equal(store.data.rooms.ABCD1234, undefined);
});

test('SQLite commits cross-collection game results and wallet rewards atomically and survives reopen', t => {
  const file = join(workspace(t), 'results.sqlite'); let store = new SqliteStore(file);
  const sessions = new SessionService(store), a = sessions.create('甲').user;
  store.transaction(data => {
    data.profiles[a.id].credits += 45; data.profiles[a.id].revision++;
    data.matches.one = { id: 'one', participants: [{ id: a.id, score: 1 }] };
    data.transactions.reward = { userId: a.id, amount: 45 };
  });
  const expected = structuredClone(store.data); store.close(); store = new SqliteStore(file);
  assert.deepEqual(store.data, expected); store.close();
});

test('a real endgame rolls back rooms, results and rewards on SQLite failure, then retries exactly once and survives restart', t => {
  let store; const file = join(workspace(t, () => store?.close()), 'endgame.sqlite'); store = new SqliteStore(file);
  const game = { manifest: { id: 'atomic', title: 'Atomic', minPlayers: 2, maxPlayers: 2, stateVersion: 1 },
    create: ids => ({ ids, count: 0, secret: 'not-visible' }), apply: s => ({ ...s, count: s.count + 1 }),
    view: s => ({ count: s.count }), isFinished: s => s.count === 2,
    result: s => ({ winners: [s.ids[0]], players: s.ids.map((id, i) => ({ id, score: 2 - i, rank: i + 1 })) }) };
  const registry = createRegistry([game]), sessions = new SessionService(store), a = sessions.create('甲').user, b = sessions.create('乙').user;
  const rooms = new RoomService(store, registry); let room = rooms.createRoom(a, { gameId: 'atomic', title: '真实终局' });
  room = rooms.join(b, room.id);
  for (const user of [a, b]) room = rooms.mutate(user, room.id, { type: 'ready', ready: true, revision: room.revision });
  room = rooms.mutate(a, room.id, { type: 'start', revision: room.revision });
  room = rooms.mutate(a, room.id, { type: 'game', command: {}, revision: room.revision });
  const before = structuredClone(store.data);
  store.db.exec("CREATE TRIGGER fail_reward BEFORE INSERT ON records WHEN NEW.collection='transactions' BEGIN SELECT RAISE(ABORT, 'test disk transaction failure'); END");
  const finish = () => rooms.mutate(b, room.id, { type: 'game', command: {}, revision: room.revision });
  assert.throws(finish, /test disk transaction failure/); assert.deepEqual(store.data, before);
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM records WHERE collection='matches'").get().n, 0);
  const persisted = JSON.parse(store.db.prepare("SELECT json FROM records WHERE collection='rooms' AND id=?").get(room.id).json);
  assert.equal(persisted.game.count, 1);
  store.db.exec('DROP TRIGGER fail_reward'); const finished = finish();
  assert.equal(finished.status, 'finished'); assert.deepEqual(finished.game, { count: 2 });
  assert.equal(Object.keys(store.data.matches).length, 1);
  assert.equal(Object.values(store.data.transactions).filter(row => row.kind === 'reward').length, 2);
  const expected = structuredClone(store.data); store.close(); store = new SqliteStore(file); assert.deepEqual(store.data, expected);
});
