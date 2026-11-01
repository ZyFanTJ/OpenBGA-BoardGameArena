import {escapeHtml as e} from '../ui.js';
import {playerAvatar,playerName} from '../player-identity.js';
export {e};
export const name=(room,id)=>room.players.find(p=>p.id===id)?.name??'玩家';
export function cards(values){return `<div class="spectator-cards">${values.map(v=>`<span class="spectator-card ${v===null?'is-hidden':''}">${v===null?'☾':e(String(v))}</span>`).join('')}</div>`;}
export function seats(room,describe){return `<div class="spectator-seats">${room.game.players.map(p=>`<article class="spectator-seat ${actorId(room)===p.id?'is-active':''}" data-player-id="${e(p.id)}">${playerHeading(room,p)}${describe(p)}</article>`).join('')}</div>`;}
export const actorId=room=>['roundEnd','finished'].includes(room.game?.phase)?null:room.game?.pending?.actorId??room.game?.active?.playerId??room.game?.turnId??room.game?.actorId;
const phases={setup:'准备开局',characters:'冒险者正在创建角色',turn:'选择抽牌',drawn:'处理抽到的牌',peek:'查看自己的暗牌',spy:'侦查暗牌',swap:'交换卡牌',reveal:'记忆卡牌',roundEnd:'本轮结算',finished:'对局结束',orient:'选择前进方向',place:'铺放地毯',draft:'选牌进行中',announce:'选择本阶段忍者',act:'使用忍者技能',react:'选择反应',color:'选择颜色',challenge:'处理 +4 质疑',setupSettlement:'放置起始村庄',setupRoad:'放置起始道路',roll:'等待掷骰',discard:'归还资源',robber:'移动强盗',steal:'抢夺资源',trade:'交易与建设',main:'交易与建设',betting:'下注进行中',leaderDraft:'轮抽领袖',recruit:'招募领袖',explore:'探索岛屿',revive:'选择复活建筑',exploration:'探索场景',combat:'战斗进行中',ending:'故事迎来结局'};
export function phaseText(room){
  if(!room.game)return '等待房主开局';
  const s=room.game,label=((room.gameId==='uno'||room.gameId==='dnup')&&s.phase==='turn'?'等待出牌':room.gameId==='catan'&&s.phase==='action'?'交易与建设':phases[s.phase])??'对局进行中',id=actorId(room);
  return ['finished','roundEnd'].includes(s.phase)?label:id?`${name(room,id)} · ${label}`:label;
}
export function progressText(room){const s=room.game;if(!s)return `${room.players.length} 位玩家已入座`;return s.handNumber?`第 ${s.handNumber} 手`:s.age?`时代 ${['I','II','III'][s.age-1]??s.age} · 第 ${s.round} 轮`:s.round?`第 ${s.round} 轮`:s.turnNumber?`第 ${s.turnNumber} 回合`:s.step!==undefined?`冒险进度 ${s.step}`:'公开牌桌';}
export function playerStats(room,p){
  switch(room.gameId){
    case 'dnup':return `${p.score} ${room.game.players.length===2?'胜':'分'} · ${p.handCount} 张牌${p.out?' · 已清手':''}`;
    case 'cabo':return `${p.total} 罚分 · ${p.cards.length} 张牌`;
    case 'uno':return `${p.total} 分 · ${p.count} 张牌${p.announced?' · UNO!':''}`;
    case 'texas-holdem':return `${p.stack} 筹码${p.out?' · 已淘汰':p.folded?' · 已弃牌':p.allIn?' · 全押':''}`;
    case 'marrakech':return `${p.coins} 钱币 · 余 ${p.remaining} 毯${p.eliminated?' · 已破产':''}`;
    case 'catan':return `${p.score} 胜利点 · ${p.resources} 张资源`;
    case 'seven-wonders':return `${p.coins} 钱币 · 奇迹 ${p.stages} 阶段`;
    case 'night-of-the-ninja':return `${p.alive?'存活':'已倒下'} · ${p.honorCount} 枚荣誉`;
    case 'dnd':return p.character?`${p.character.name} · HP ${p.character.hp}/${p.character.maxHp}`:'正在创建角色';
    default:return '已入座';
  }
}
export function playerHeading(room,p){return `<div class="spectator-seat-heading">${playerAvatar(room,p.id)}<h2>${playerName(room,p.id)}${room.game.winners?.includes(p.id)?' ♛':''}</h2></div>`;}
export function frame(room,content){return `<div class="spectator-table spectator-table-${e(room.gameId)}">${content}</div>`;}
