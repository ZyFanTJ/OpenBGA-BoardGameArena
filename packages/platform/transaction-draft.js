import {flatStorage, domainDraft} from './storage-layout.js';
// Collections hold independent JSON records. Singletons (settings, etc.)
// remain one record each. A transaction clones only the records it actually reads.
export const recordCollections = Object.freeze(['sessions', 'rooms', 'accounts', 'profiles', 'friendships', 'invitations', 'matches', 'transactions', 'friendConversations', 'gameAppointments']);
const collections = new Set([...recordCollections, 'forumTopics']);

export function transactionDraft(input) {
  const base = flatStorage(input);
  const roots = new Map(), tables = new Map();
  function table(name) {
    const source = base[name], reads = new Map(), removed = new Set();
    const proxy = new Proxy({}, {
      get(_, key) {
        if (typeof key !== 'string') return undefined;
        if (removed.has(key)) return undefined;
        if (!reads.has(key) && Object.hasOwn(source, key)) reads.set(key, structuredClone(source[key]));
        return reads.has(key) ? reads.get(key) : Reflect.get(Object.prototype, key);
      },
      set(_, key, value) { reads.set(key, value); removed.delete(key); return true; },
      deleteProperty(_, key) { reads.delete(key); removed.add(key); return true; },
      has(_, key) { return !removed.has(key) && (reads.has(key) || Object.hasOwn(source, key)); },
      ownKeys() { return [...new Set([...Object.keys(source), ...reads.keys()])].filter(key => !removed.has(key)); },
      getOwnPropertyDescriptor(_, key) {
        if (!removed.has(key) && (reads.has(key) || Object.hasOwn(source, key))) return { enumerable: true, configurable: true };
      },
    });
    const result = { proxy, reads, removed }; tables.set(name, result); return result;
  }
  const draft = new Proxy({}, {
    get(_, key) {
      if (roots.has(key)) return roots.get(key);
      if (collections.has(key) && base[key]) return (tables.get(key) ?? table(key)).proxy;
      if (Object.hasOwn(base, key)) { roots.set(key, structuredClone(base[key])); return roots.get(key); }
    },
    set(_, key, value) { roots.set(key, value); return true; },
    ownKeys() { return [...new Set([...Object.keys(base), ...roots.keys()])]; },
    getOwnPropertyDescriptor(_, key) {
      if (roots.has(key) || Object.hasOwn(base, key)) return { enumerable: true, configurable: true };
    },
  });
  function changes() {
    const changed = [];
    const compare = (collection, key, before, after) => {
      const json = after === undefined ? null : JSON.stringify(after);
      if (json !== (before === undefined ? null : JSON.stringify(before))) changed.push({ collection, key, value: after, json });
    };
    for (const [name, value] of roots) {
      if (collections.has(name)) {
        for (const key of new Set([...Object.keys(base[name] ?? {}), ...Object.keys(value)])) compare(name, key, base[name]?.[key], value[key]);
      } else compare('', name, base[name], value);
    }
    for (const [name, { reads, removed }] of tables) {
      if (roots.has(name)) continue;
      for (const [key, value] of reads) compare(name, key, base[name][key], value);
      for (const key of removed) compare(name, key, base[name][key], undefined);
    }
    return changed;
  }
  return { draft: domainDraft(draft), changes };
}

export function applyChanges(data, changes) {
  for (const { collection, key, value } of changes) {
    const target = collection === 'forumTopics' ? data.forum.topics : collection ? data[collection] : data;
    if (value === undefined) delete target[key];
    else Object.defineProperty(target, key, { value: !collection && key === 'forum' ? {...value, topics:data.forum.topics} : value, writable: true, enumerable: true, configurable: true });
  }
}

export function storageRecords(data) {
  return Object.entries(flatStorage(data)).flatMap(([name, value]) => collections.has(name)
    ? Object.entries(value).map(([key, record]) => ({ collection: name, key, value: record, json: JSON.stringify(record) }))
    : [{ collection: '', key: name, value, json: JSON.stringify(value) }]);
}
