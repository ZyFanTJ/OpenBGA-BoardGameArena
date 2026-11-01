/** Physical SQLite layout v2 splits forum topics without changing the domain/game state shape. */
export function flatStorage(data) {
  const {topics, ...forum} = data.forum;
  return {...data, forum, forumTopics: topics};
}

export function domainDraft(flat) {
  const forum = new Proxy({}, {
    get: (_, key) => key === 'topics' ? flat.forumTopics : flat.forum[key],
    set(_, key, value) { if (key === 'topics') flat.forumTopics = value; else flat.forum[key] = value; return true; },
    ownKeys: () => [...Object.keys(flat.forum), 'topics'],
    has: (_, key) => key === 'topics' || key in flat.forum,
    getOwnPropertyDescriptor: (_, key) => key === 'topics' || Object.hasOwn(flat.forum, key) ? {enumerable:true, configurable:true} : undefined,
  });
  return new Proxy(flat, {
    get: (target, key) => key === 'forum' ? forum : key === 'forumTopics' ? undefined : target[key],
    set(target, key, value) {
      if (key === 'forum') { const {topics, ...metadata} = value; target.forum = metadata; target.forumTopics = topics; }
      else target[key] = value;
      return true;
    },
    ownKeys: target => Reflect.ownKeys(target).filter(key => key !== 'forumTopics'),
    getOwnPropertyDescriptor: (target, key) => key === 'forumTopics' ? undefined : Reflect.getOwnPropertyDescriptor(target, key),
  });
}
