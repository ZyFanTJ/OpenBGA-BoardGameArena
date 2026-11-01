import {escapeHtml as e} from './ui.js';

export function roundWaiting(room) {
  const host=room.players.find(p=>p.id===room.hostId)?.name??'房主';
  return `<details class="round-waiting"><summary><i aria-hidden="true"></i>等待房主开启下一轮 <span>⌄</span></summary><p>${e(host)} 开启下一轮后，你会自动进入，无需刷新。可以收起结算查看牌桌，或使用右上角聊天与同桌交流。</p></details>`;
}
