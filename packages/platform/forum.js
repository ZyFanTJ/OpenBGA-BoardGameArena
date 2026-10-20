import {randomUUID} from 'node:crypto';
import {ensure} from './errors.js';
import {boundedText} from './validation.js';
import {systemSettings} from './system.js';

export const forumCategories = ['suggestion', 'game', 'chat'];
const pageSize = 20;
function findTopic(data, id) {
  const topic = Object.hasOwn(data.forum.topics, id) ? data.forum.topics[id] : undefined;
  ensure(topic, '话题不存在', 404);
  return topic;
}
function contactText(value) {
  if (value === undefined || value === '') return '';
  ensure(typeof value === 'string' && value.trim().length <= 120, '联系方式最多 120 字');
  return value.trim();
}

/** Owns public player discussions; independent of rooms, chat and game state. */
export class ForumService {
  constructor(store, {now = () => Date.now()} = {}) { this.store = store; this.now = now; }
  author(id) {
    const profile = this.store.data.profiles[id];
    return {id, name: profile?.name ?? '月下旅人', appearance: {avatar: profile?.equipped?.avatar ?? 'avatar-traveler'}};
  }
  summary(topic, user) {
    return {id: topic.id, number: topic.number, title: topic.title, category: topic.category, status: topic.status,
      author: this.author(topic.authorId), excerpt: topic.body.slice(0, 150), createdAt: topic.createdAt,
      updatedAt: topic.updatedAt, replyCount: topic.replies.length, supportCount: topic.supporters.length,
      supported: topic.supporters.includes(user?.id), owner: topic.authorId === user?.id, revision: topic.revision};
  }
  list(user, query = {}) {
    const {category = 'all', status = 'all', sort = 'activity'} = query;
    ensure(category === 'all' || forumCategories.includes(category), '话题分类无效');
    ensure(['all', 'open', 'closed'].includes(status), '话题状态无效');
    ensure(['activity', 'newest', 'popular'].includes(sort), '排序方式无效');
    ensure(query.q === undefined || (typeof query.q === 'string' && query.q.length <= 100), '搜索内容最多 100 字');
    const q = (query.q ?? '').trim().toLocaleLowerCase();
    const all = Object.values(this.store.data.forum.topics);
    const rows = all.filter(t => (category === 'all' || t.category === category) && (status === 'all' || t.status === status)
      && (!q || `${t.title}\n${t.body}`.toLocaleLowerCase().includes(q)));
    rows.sort((a, b) => (sort === 'popular' ? b.supporters.length - a.supporters.length : 0)
      || (sort === 'newest' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt) || b.number - a.number);
    const requested = Number(query.page ?? 1);
    ensure(Number.isSafeInteger(requested) && requested > 0, '页码无效');
    const pages = Math.max(1, Math.ceil(rows.length / pageSize)), page = Math.min(requested, pages);
    return {items: rows.slice((page - 1) * pageSize, page * pageSize).map(t => this.summary(t, user)), total: rows.length, page, pages,
      counts: {all: all.length, open: all.filter(t => t.status === 'open').length, closed: all.filter(t => t.status === 'closed').length,
        ...Object.fromEntries(forumCategories.map(c => [c, all.filter(t => t.category === c).length]))}};
  }
  detail(user, id) {
    const topic = findTopic(this.store.data, id);
    return {...this.summary(topic, user), body: topic.body, contact: topic.contact,
      replies: topic.replies.map(r => ({id: r.id, author: this.author(r.authorId), body: r.body, contact: r.contact, createdAt: r.createdAt}))};
  }
  create(user, input) {
    const title = boundedText(input.title, 80), body = boundedText(input.body, 2000), contact = contactText(input.contact);
    ensure(forumCategories.includes(input.category), '请选择话题分类');
    const id = randomUUID(), at = this.now();
    this.store.transaction(data => {
      ensure(systemSettings(data).forumPostingEnabled,'论坛发帖与回复暂时关闭',403);
      data.forum.topics[id] = {id, number: data.forum.nextNumber++, authorId: user.id, title, body, contact,
        category: input.category, status: 'open', createdAt: at, updatedAt: at, revision: 0, supporters: [], replies: []};
    });
    return this.detail(user, id);
  }
  reply(user, id, input) {
    const body = boundedText(input.body, 2000), contact = contactText(input.contact);
    this.store.transaction(data => {
      ensure(systemSettings(data).forumPostingEnabled,'论坛发帖与回复暂时关闭',403);
      const topic = findTopic(data, id);
      ensure(topic.status === 'open', '话题已结束', 409);
      const at = this.now();
      topic.replies.push({id: randomUUID(), authorId: user.id, body, contact, createdAt: at});
      topic.updatedAt = at; topic.revision++;
    });
    return this.detail(user, id);
  }
  support(user, id, input) {
    ensure(typeof input.supported === 'boolean', '支持操作无效');
    this.store.transaction(data => {
      const topic = findTopic(data, id);
      const has = topic.supporters.includes(user.id);
      if (has === input.supported) return;
      topic.supporters = input.supported ? [...topic.supporters, user.id] : topic.supporters.filter(id => id !== user.id);
      topic.revision++;
    });
    return this.detail(user, id);
  }
  status(user, id, input) {
    ensure(['open', 'closed'].includes(input.status), '话题状态无效');
    this.store.transaction(data => {
      const topic = findTopic(data, id);
      ensure(topic.authorId === user.id, '只有发帖人可以修改话题状态', 403);
      ensure(topic.revision === input.revision, '话题有新动态，请刷新后重试', 409);
      topic.status = input.status; topic.updatedAt = this.now(); topic.revision++;
    });
    return this.detail(user, id);
  }
}
