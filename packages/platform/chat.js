import { randomUUID } from 'node:crypto';
import { ensure } from './errors.js';
import { boundedText } from './validation.js';

/** Chat has no game-rule dependency and never advances room/game revision. */
export class ChatService {
  constructor(store, rooms) { this.store = store; this.rooms = rooms; }
  send(user, roomId, text) {
    const content = boundedText(text, 500);
    this.store.transaction(data => {
      const room = this.rooms.room(roomId, data); this.rooms.member(room, user);
      const last = room.chat.findLast(m => m.userId === user.id);
      ensure(!last || Date.now() - last.at >= 500, '消息发送太快', 429);
      room.chat.push({ id: randomUUID(), userId: user.id, name: user.name, text: content, at: Date.now() });
      room.chat = room.chat.slice(-100);
    });
    this.rooms.notify(roomId);
    return { ok: true };
  }
}
