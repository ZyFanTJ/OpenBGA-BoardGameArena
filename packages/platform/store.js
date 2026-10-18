import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Single-process transactional adapter. Replace this boundary with a database for scale. */
export class JsonStore {
  constructor(file) {
    this.file = file;
    this.data = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { version: 1, sessions: {}, rooms: {} };
    if (this.data.version !== 1) throw new Error('Unsupported storage version; migrate before starting.');
  }
  transaction(update) {
    const next = structuredClone(this.data);
    const result = update(next);
    if (this.file) {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(`${this.file}.tmp`, JSON.stringify(next), { mode: 0o600 });
      renameSync(`${this.file}.tmp`, this.file);
    }
    this.data = next;
    return result;
  }
}
