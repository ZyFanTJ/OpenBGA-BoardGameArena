import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ensure } from './errors.js';
import { boundedText } from './validation.js';

const hash = token => createHash('sha256').update(token).digest('hex');
export class SessionService {
  constructor(store) { this.store = store; }
  create(name) {
    const token = randomBytes(32).toString('hex');
    const user = { id: randomUUID(), name: boundedText(name, 24), createdAt: Date.now() };
    this.store.transaction(data => { data.sessions[hash(token)] = user; });
    return { token, user };
  }
  authenticate(token) {
    ensure(typeof token === 'string' && token.length === 64, '请先输入昵称', 401);
    const user = this.store.data.sessions[hash(token)];
    ensure(user, '会话已失效，请重新进入', 401);
    return user;
  }
}
