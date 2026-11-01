import {frame,e,name} from '../spectator-ui.js';
import {createCatanRenderer} from './index.js';
import {icon} from './icons.js';
export function render(room){
  const s=room.game,board=createCatanRenderer().renderBoard(room);
  return frame(room,`<section class="ct-game ct-hud spectator-catan" aria-label="卡坦岛公开棋盘"><div class="spectator-catan-hud"><b>CATAN</b><span>目标 10 胜利点</span><span class="ct-dice" aria-label="骰子 ${s.dice.join('、')||'尚未掷骰'}">${s.dice.map(n=>`<span>${['','⚀','⚁','⚂','⚃','⚄','⚅'][n]}</span>`).join('')}</span></div><div class="ct-stage">${board}</div><div class="spectator-catan-legend">${s.players.map((p,i)=>`<span data-player-id="${e(p.id)}" class="ct-player-${i}"><i></i>${e(name(room,p.id))} ${p.score}/10 ${s.longest===p.id?icon('road'):''}${s.army===p.id?icon('knight'):''}</span>`).join('')}</div>${s.offer?`<div class="spectator-public-offer"><b>${e(name(room,s.offer.from))} 提出交易</b>${Object.entries(s.offer.give).filter(([,v])=>v).map(([k,v])=>icon(k)+v).join(' ')} ⇄ ${Object.entries(s.offer.want).filter(([,v])=>v).map(([k,v])=>icon(k)+v).join(' ')}</div>`:''}${s.phase==='finished'?`<div class="spectator-results"><h2>${e(name(room,s.winner))} 获胜</h2></div>`:''}</section>`);
}
