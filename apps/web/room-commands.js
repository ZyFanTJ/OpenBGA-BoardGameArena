import { api } from './api.js';

/** A pending room write blocks only another room write. Menus, chat, navigation
 * and game inspection keep working, and late responses cannot reopen old rooms. */
export function createRoomCommands({ getRoom, receive, left, request = api }) {
  const pending = new Set();
  return async function send(input) {
    const room = getRoom();
    if (!room) return;
    if (pending.has(room.id)) throw new Error('上一项牌桌操作仍在提交，请稍候');
    const { id, matchId } = room;
    pending.add(id);
    try {
      const snapshot = await request(`/rooms/${id}/actions`, {
        matchId, submissionKey: room.submissionKey, ...input, revision: input.revision ?? room.revision,
      });
      if (getRoom()?.id !== id || getRoom()?.matchId !== matchId) return;
      if (snapshot.left) left(snapshot); else receive(snapshot);
    } catch (error) { error.roomId = id; throw error; }
    finally { pending.delete(id); }
  };
}
