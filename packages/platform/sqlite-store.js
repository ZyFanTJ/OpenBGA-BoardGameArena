import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrateStorage } from './store.js';
import { recordCollections, transactionDraft, applyChanges, storageRecords } from './transaction-draft.js';
import { RecordIndexes } from './record-index.js';

/** Single-process store: synchronous domain transactions, record-sized WAL commits.
 * The existing JSON file is imported once and left intact for rollback/backup.
 * Do not run multiple application processes against the same database: live views
 * and schedulers are owned by this process, even though SQLite serializes writes.
 */
export class SqliteStore {
  constructor(file = ':memory:', { legacyFile } = {}) {
    this.indexes = new RecordIndexes();
    this.file = file === ':memory:' ? undefined : file;
    this.secretsFile = legacyFile ? `${legacyFile}.secrets.key` : this.file ? `${this.file}.secrets.key` : undefined;
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    try {
      if (file !== ':memory:') chmodSync(file, 0o600);
      this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
      this.db.exec('CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(collection,id)) WITHOUT ROWID');
      this.put = this.db.prepare('INSERT INTO records VALUES (?, ?, ?) ON CONFLICT(collection,id) DO UPDATE SET json=excluded.json');
      this.remove = this.db.prepare('DELETE FROM records WHERE collection=? AND id=?');
      const rows = this.db.prepare('SELECT collection, id, json FROM records').all();
      if (rows.length) {
        const input = Object.fromEntries(recordCollections.map(name => [name, {}]));
        input.forum = {topics:{}};
        let legacyForum = false;
        for (const row of rows) {
          const target = row.collection === 'forumTopics' ? input.forum.topics : row.collection ? input[row.collection] : input;
          if (!target) throw new Error('Unknown storage collection');
          let value = JSON.parse(row.json);
          if (!row.collection && row.id === 'forum') {
            legacyForum = Object.hasOwn(value, 'topics');
            value = {...value, topics:value.topics ?? input.forum.topics};
          }
          Object.defineProperty(target, row.id, { value, writable: true, enumerable: true, configurable: true });
        }
        this.data = migrateStorage(input);
        // One atomic rewrite migrates old singleton forums. Domain and game versions do not change.
        if (legacyForum || input.version !== this.data.version) this.persist(storageRecords(this.data));
      } else {
        const input = legacyFile && existsSync(legacyFile) ? JSON.parse(readFileSync(legacyFile, 'utf8')) : { version: 1, sessions: {}, rooms: {} };
        this.data = migrateStorage(input);
        this.persist(storageRecords(this.data));
      }
    } catch (error) { this.db.close(); throw error; }
  }
  persist(changes) {
    if (!changes.length) return;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const { collection, key, json } of changes) {
        if (json === null) this.remove.run(collection, key); else this.put.run(collection, key, json);
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  transaction(update) {
    if (this.updating) throw new Error('Nested storage transactions are not supported');
    this.updating = true;
    try {
      const { draft, changes } = transactionDraft(this.data);
      const result = update(draft);
      if (result && typeof result.then === 'function') throw new Error('Storage transactions must be synchronous');
      const changed = changes();
      this.persist(changed);
      this.indexes.committed(this.data, changed);
      applyChanges(this.data, changed);
      return result;
    } finally { this.updating = false; }
  }
  close() { this.db.close(); }
  selectRecords(collection, name, keys, key) { return this.indexes.select(this.data, collection, name, keys, key); }
}
