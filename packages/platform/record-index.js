/** Derived, in-memory indexes. Only committed changes update them; values stay in the store. */
export class RecordIndexes {
  constructor() { this.indexes = new Map(); }
  select(data, collection, name, keys, key) {
    const id = `${collection}:${name}`;
    let index = this.indexes.get(id);
    if (!index) {
      index = {collection, keys, rows: new Map()};
      for (const [id, value] of Object.entries(data[collection])) this.add(index, id, value);
      this.indexes.set(id, index);
    }
    return [...(index.rows.get(key) ?? [])].map(id => data[collection][id]);
  }
  add(index, id, value) {
    for (const key of new Set(index.keys(value))) {
      if (!index.rows.has(key)) index.rows.set(key, new Set());
      index.rows.get(key).add(id);
    }
  }
  committed(data, changes) {
    for (const change of changes) for (const index of this.indexes.values()) {
      if (index.collection !== change.collection) continue;
      const before = data[change.collection][change.key];
      for (const key of before ? new Set(index.keys(before)) : []) {
        const rows = index.rows.get(key); rows?.delete(change.key);
        if (rows?.size === 0) index.rows.delete(key);
      }
      if (change.value !== undefined) this.add(index, change.key, change.value);
    }
  }
}

/** Other adapters retain the same service API without needing to implement indexes. */
export function indexedRecords(store, collection, name, keys, key) {
  return store.selectRecords ? store.selectRecords(collection, name, keys, key)
    : Object.values(store.data[collection]).filter(value => keys(value).includes(key));
}
