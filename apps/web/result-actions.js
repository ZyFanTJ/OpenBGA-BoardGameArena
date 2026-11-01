import {button as b} from './ui.js';

/** Shared postgame controls use only the player's authoritative room view. */
export function resultActions(room, user, {roomView = false} = {}) {
  if (room?.status !== 'finished') return '';
  const host = room.hostId === user.id, votes = room.rematchVotes ?? [], voted = votes.includes(user.id);
  const peers = room.players.some(player => !player.isBot && player.id !== user.id);
  return `<footer class="match-result-footer" aria-label="对局后操作"><div class="match-result-actions">
    ${b('分享战绩', 'table:share', false, 'class="match-share"')}
    ${b(roomView ? '查看战绩' : '返回房间', roomView ? 'table:results' : 'table:room', false, 'class="match-return"')}
    ${b(host ? '再来一局' : voted ? '已准备，等待房主' : '准备下一局', 'table:again', !host && voted, 'class="match-again"')}
  </div>${votes.length ? `<p class="match-result-votes" role="status">${votes.length} 位牌友想继续</p>` : ''}${peers ? '<details class="match-result-social"><summary>同桌好友</summary><div data-result-peers></div></details>' : ''}</footer>`;
}
