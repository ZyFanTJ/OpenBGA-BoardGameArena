import {escapeHtml as e} from '../ui.js';
import {icon} from '../icons.js';
const art={cabo:'/assets/lobby/hero-display-v1.webp',uno:'/assets/lobby/cover-uno-v1.webp',marrakech:'/assets/marrakech/market-v1.webp','seven-wonders':'/assets/lobby/wonders-cover-v1.webp','night-of-the-ninja':'/assets/night-of-the-ninja/cover-v1.webp',dnd:'/assets/dnd/scenes/village-v1.webp',catan:'/assets/lobby/catan-preview-v1.webp'};
const date=at=>at?new Date(at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'历史记录';
export const recordArt=m=>art[m.gameId]??art.cabo;
export function matchHighlights(m){
  const p=m.own;if(p.left)return ['中途离席'];
  const tags=[];
  if(p.rank===1)tags.push(m.participants.filter(q=>q.rank===1).length>1?'并列第一':'本场冠军');
  else if(p.rank<=3&&m.participants.length>=3)tags.push('登上领奖台');
  if(m.scoreDirection==='lower'&&p.score===0)tags.push('零罚分完赛');
  for(const item of p.breakdown??[]){
    if(tags.length>=3)break;
    if(item.value>0&&m.scoreDirection!=='lower'&&m.participants.every(q=>(q.breakdown??[]).find(x=>x.label===item.label)?.value<=item.value))tags.push(`${item.label}领先`);
  }
  if(p.won&&!tags.length)tags.push('胜利达成');
  if(!tags.length)tags.push('完成对局');
  return tags;
}
export function historyCard(m){const p=m.own,champion=p.rank===1&&!p.left,tags=matchHighlights(m),humans=m.participants.filter(p=>!p.isBot).length;
  return `<article class="match-card ${champion?'match-champion':''}" data-game="${e(m.gameId)}"><div class="match-card-content"><div class="match-row-title"><h3>${e(m.gameTitle)}</h3><p>${m.practice?'AI 练习':'真人对局'} · ${m.participants.length} 人 / ${humans} 真人 · ${m.rounds??1} ${m.gameId==='seven-wonders'?'时代':m.gameId==='catan'?'回合':'轮'}</p><time>${date(m.endedAt)}</time></div><div class="match-row-result"><div class="match-place">${champion?icon('crown'):''}<b>${p.left?'已离席':`第 ${p.rank} 名`}</b></div><span>${p.score} ${m.scoreDirection==='lower'?'罚分':'分'}</span></div><div class="match-highlights" aria-label="本局表现徽章">${tags.map(t=>`<span>${icon(t.includes('第一')||t.includes('冠军')?'crown':'spark')}${e(t)}</span>`).join('')}</div><div class="match-row-action"><span>${p.reward?`+${p.reward} 星辉`:'已保存'}</span><button class="hub-secondary" data-action="hub:record" data-id="${e(m.id)}" aria-label="查看 ${e(m.gameTitle)} ${date(m.endedAt)} 的战报">战报 ${icon('arrow')}</button></div></div></article>`;
}
