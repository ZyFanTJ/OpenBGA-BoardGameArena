import {escapeHtml as e} from '../../ui.js';
import {icon,costSymbols,effectSymbols,resourceNames} from './symbols.js';
import {leaderPortraits} from './leader-art.js';
export const fleetNames={red:'战舰',yellow:'商船',blue:'民用船',green:'探险船'};
const red=[0,1,2,3,4,5,8],blue=[0,1,2,4,6,8,10],commerce=[0,1,1,2,2,3,4];
export function extensionArt(c){
 const portrait=leaderPortraits[c.key];
 if(c.color==='white'&&portrait)return `<img class="sw-extension-art sw-leader-portrait sw-portrait-${e(c.key)}" src="${portrait}" alt="" loading="lazy" decoding="async">`;
 if(c.color==='island')return `<svg class="sw-extension-art" viewBox="0 0 300 220" aria-hidden="true"><path fill="#254a60" d="M0 0h300v220H0z"/><circle cx="230" cy="45" r="23" fill="#f0ce83"/><path d="M0 110q70-25 150 0t150 0v110H0" fill="#176677"/><path d="m25 160 58-43 30-77 38 50 34-28 32 65 62 37z" fill="#264d4b"/><path d="m83 117 30-77 38 50-37-25-12 58m49-33 34-28 32 65-33-45z" fill="#8b966b"/><path d="M25 160q110-25 254 4l-30 12H52z" fill="#d4bd7b"/><path d="M0 191q40-8 80 0t80 0 80 0 80 0M5 207q65-10 130 0t140 0" fill="none" stroke="#74bbbf"/><text x="30" y="40" fill="#f0d59a" font-family="serif" font-size="28">${['I','II','III'][c.level-1]}</text></svg>`;
 return null;
}
export function fleetReward(color,pos){if(!pos)return '—';if(color==='red')return `${icon('naval')}<b>${red[pos]}</b>`;if(color==='blue')return `${icon('points')}<b>${blue[pos]}</b>${pos===6?icon('naval'):''}`;if(color==='green')return pos%2===0?`${icon('island')}<b>${['I','II','III'][pos/2-1]}</b>`:'·';return pos===6?`${icon('naval')}<b>2</b>`:pos===1?'·':`${icon('coin')}<b>${pos}</b>`;}
export function fleetPanel(p,{compact=false}={}){
 if(!p.fleets)return '';
 return `<section class="sw-fleet-panel ${compact?'sw-fleet-compact':''}" aria-label="${e(p.wonderName)}的舰队"><header><h3>${icon('ship')}舰队</h3><span title="海军实力">${icon('naval')}<b>${p.naval}</b></span><span title="当前商业等级，抵扣其他玩家征税">${icon('amphora')}<b>${p.commercial}</b></span><span title="蓝色舰队计分">${icon('points')}<b>${p.fleetPoints}</b></span></header><div class="sw-fleet-tracks">${Object.entries(fleetNames).map(([color,label])=>{
  const pos=p.fleets[color];
  return `<div class="sw-fleet-row sw-${color}"><div class="sw-fleet-name">${icon('ship')}<b>${label}</b>${p.shipyard.linked===color?icon('wonder','与奇迹关联'):''}</div><div class="sw-fleet-route"><ol aria-label="${label} ${pos}/6">${Array.from({length:7},(_,i)=>{
   const cost=i?p.shipyard.costs[color][i-1]:null,tax=color==='yellow'?({2:1,4:2,6:4}[i]??0):0;
   const costText=cost?[cost.coins?`${cost.coins} 钱币`:'',[...cost.resources].map(r=>resourceNames[r]).join('、')].filter(Boolean).join('，'):'';
   return `<li class="${i===pos?'sw-fleet-current':i<pos?'sw-fleet-past':'sw-fleet-future'}" data-node="${i}" aria-label="${label}第 ${i} 格${i===pos?'，当前位置':''}${cost?'，印刷成本 '+costText:''}${color==='yellow'?'，商业等级 '+commerce[i]:''}${tax?'，征税 '+tax:''}"><span>${i===pos?icon('ship'):i}</span><small class="sw-fleet-reward">${fleetReward(color,i)}</small>${color==='yellow'?`<div class="sw-fleet-commerce" title="商业等级 ${commerce[i]}${tax?'；此格征税 '+tax:''}">${icon('amphora')}<b>${commerce[i]}</b>${tax?`<em>${icon('tax')}<b>${tax}</b></em>`:''}</div>`:''}<div class="sw-fleet-cost" title="${cost?'推进至此格的印刷成本：'+costText:'起点'}" aria-label="${cost?'推进成本 '+costText:'起点'}">${cost?costSymbols(cost):'—'}</div></li>`;
  }).join('')}</ol></div></div>`;
 }).join('')}</div><div class="sw-fleet-footer"><span>${icon('amphora')}商业 ${p.commercial}${p.islands?.some(c=>c.effect.taxShield)?` · ${icon('shield')}免税`:' · 抵扣税收'}</span><details class="sw-tax-rule"><summary>${icon('tax')}税收规则</summary><p>回合末，其他玩家损失「税额 − 自身商业等级」的钱币，最低为 0。同回合多次征税只取最高税额，该税额的征税者免缴。商业等级不抵扣海盗损失。</p></details>${p.boardings.length?`<span>${icon('shield')}本时代有登船战</span>`:''}</div></section>`;
}

export function expansionCity(p,cardFace){return `${p.leaders?`<section class="sw-extension-collection"><h3>${icon('crown')}领袖 <b>${p.leaders.length}</b></h3><div class="sw-city-cards">${p.leaders.map(c=>cardFace(c,{query:false,interactive:false,miniature:true,availability:false})).join('')||'<p class="sw-empty-city">尚未招募</p>'}</div>${p.mummies.map(x=>`<span class="sw-mummy">${icon('wonder')}${e(x.name)} · ${x.points} 分</span>`).join('')}</section>`:''}${fleetPanel(p)}${p.islands?`<section class="sw-extension-collection"><h3>${icon('island')}岛屿 <b>${p.islands.length}</b></h3><div class="sw-city-cards">${p.islands.map(c=>cardFace(c,{interactive:false,miniature:true,availability:false})).join('')||'<p class="sw-empty-city">尚未发现</p>'}</div></section>`:''}`;}
