import {escapeHtml as e} from '../../ui.js';
import {icon} from './symbols.js';

// Original vector drawings of the second-edition chain pictograms.
const glyphs={
 rosette:'<circle cx="12" cy="10" r="5"/><circle cx="20" cy="10" r="5"/><circle cx="16" cy="17" r="5"/><path d="m14 21-4 9 6-3 6 3-4-9"/>',
 drop:'<path d="M16 3S6 14 6 20a10 10 0 0 0 20 0C26 14 16 3 16 3zM10 21q0 5 5 5"/>',
 star:'<path d="m16 3 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1z"/>',
 mask:'<path d="m5 5 11 3 11-3-2 14c-2 8-9 11-9 11S9 27 7 19zM9 13l5 2m4 0 5-2M10 20q6 7 12 0"/>',
 camel:'<path d="m3 15 4-3 3 1 3-5 4 3 3-3 3 5 2-8 4 1-1 9-4 4-1 10h-3l-1-10H11L8 29H5l2-13M3 15l-1 5"/>',
 table:'<path d="M5 11h22v6H5zM8 17 5 29m19-12 3 12M8 8V3h5v8m6-3V3h5v8"/>',
 beacon:'<path d="m10 28 3-18h6l3 18zM10 10V5h12v5M13 5l3-3 3 3M7 29h18M15 14h2m-3 6h4M5 6H2m28 0h-3"/>',
 barrel:'<path d="M9 3h14c7 8 7 18 0 26H9C2 21 2 11 9 3zM8 9h16M7 23h18M12 4q-5 12 0 24m8-24q5 12 0 24"/><circle cx="16" cy="16" r="2"/>',
 horseshoe:'<path d="M7 29C-4 2 36 2 25 29l-7-3C27 7 5 7 14 26zM7 17l3-1m12 1 3 1M10 9l2 2m8 0 2-2M15 7h2"/>',
 mortar:'<path d="M4 15h24c-1 9-6 12-12 12S5 24 4 15zM11 28h10M18 15l8-12 4 3-11 9M4 12h14"/>',
 bolt:'<path d="m18 2-14 18h10l-1 10 15-19H17z"/>',
 torch:'<path d="m12 18 8 2-5 11-5-2zM12 17C1 11 18 2 17 1c0 5 9 5 8 11-1 6-9 8-13 5z"/>',
 target:'<circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="9"/><circle cx="16" cy="16" r="4"/><path d="m16 16 13-13m-6 1h5v5"/>',
 lamp:'<path d="M6 19h16c0 9-16 9-16 0zm2-1-4-4 5 1 3 3m10 2c8 1 8-8 2-7M11 15c-5-5 4-5 1-10m5 10c-5-5 4-5 1-10M8 29h14"/>',
 saw:'<path d="m3 19 19-14 7 5-4 7-4-1-1 4-4-1-1 4-4-1-1 4-7 1zM23 8l-2 5 4 1 2-4z"/>',
 planet:'<ellipse cx="16" cy="16" rx="15" ry="5" transform="rotate(-30 16 16)"/><circle cx="16" cy="16" r="10"/><path d="m5 23 4-3m15-9 4-2"/>',
 scales:'<path d="M16 3v25M8 29h16M5 9h22M16 3l-3 5h6zM6 10 2 21h8zm20 0-4 11h8zM2 21q4 7 8 0m12 0q4 7 8 0"/>',
 book:'<path d="M16 7C10 2 3 4 3 4v23s7-3 13 1c6-4 13-1 13-1V4s-7-2-13 3zM16 7v21M6 10l6 1M6 15l6 1m8-5 6-1m-6 6 6-1"/>',
 columns:'<path d="M3 6h26M4 3h24M3 29h26M5 26h22M7 9v15m9-15v15m9-15v15M5 9h4m5 0h4m5 0h4"/>',
 scroll:'<path d="M7 5h18v22H7zM7 5C1 0 1 11 7 9m18-4c6-5 6 6 0 4M7 23c-6-5-6 6 0 4m18-4c6-5 6 6 0 4M11 11h10m-10 5h10m-10 5h7"/>',
 lyre:'<path d="M6 3c6 5-4 19 3 25 4 4 10 4 14 0 7-6-3-20 3-25M7 7h18M11 8v18m5-18v21m5-21v18M9 24h14"/>',
 feather:'<path d="M4 30 24 7M9 23C0 10 20 1 30 2c-1 12-8 26-21 21zM12 15l8-1m-3-5 6-1m-8 12 7-1"/>',
 battlement:'<path d="M4 28V4h5v6h5V4h5v6h5V4h5v24zM13 28V18h7v10M7 14h2m15 0h2"/>',
 helmet:'<path d="M9 27C-5 10 10-2 22 7l7 7-11-2-6 8 8 3-6 7zM9 27c-5-17 6-23 14-18M18 16l5 2 1 9-5-2"/>',
};

export function chainMark(symbol,extra=''){
 if(!symbol)return '';
 return `<span class="sw-chain-mark ${extra}" data-chain-symbol="${e(symbol.id)}" title="${e(symbol.name)}" role="img" aria-label="连锁图案：${e(symbol.name)}"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[symbol.id]??''}</svg></span>`;
}
export function outgoingMarks(c){
 const unique=[...new Map((c.chains?.to??[]).map(x=>[x.symbol?.id,x])).values()].filter(x=>x.symbol);
 return unique.length?`<span class="sw-card-unlocks" title="建成后可免费建造：${e(c.chains.to.map(x=>x.name).join('、'))}"><small>解锁</small>${unique.map(x=>chainMark(x.symbol)).join('')}</span>`:'';
}
export function requiredMark(c,owned=[]){
 const from=c.chains?.from??[],symbol=from[0]?.symbol;
 if(!symbol)return '';
 const matched=from.some(x=>owned.some(y=>y.kind===x.kind));
 return `<span class="sw-card-chain-cost ${matched?'sw-chain-satisfied':''}" title="持有${e(from.map(x=>x.name).join('或'))}可免费建造"><small>或</small>${chainMark(symbol)}${matched?icon('check'):''}</span>`;
}
export function ownedChainBar(game,p){
 const routes=game.chainCatalogue??[];
 const held=[...new Map(routes.filter(r=>r.to.minPlayers<=game.players.length&&r.from.some(x=>p.cards.some(c=>c.kind===x.kind))).map(r=>[r.symbol.id,r])).values()];
 const free=game.hand.filter(c=>c.build?.plans[0]?.reason==='chain').length;
 return `<button type="button" class="sw-chain-inventory" data-action="game:chains" aria-label="查看连锁图谱，${held.length} 个已持有图案，${free} 张手牌可免费建造"><span>${icon('chain')}连锁</span><span class="sw-chain-inventory-marks">${held.slice(0,12).map(r=>chainMark(r.symbol)).join('')||'<small>尚无图案</small>'}${held.length>12?`<small>+${held.length-12}</small>`:''}</span><span class="sw-chain-hand-count ${free?'sw-chain-ready':''}">${free?`${free} 张手牌免费`:'查看图谱'}${icon('right')}</span></button>`;
}
export function chainRoutes(game,p,filter='all'){
 const rows=(game.chainCatalogue??[]).filter(r=>r.to.minPlayers<=game.players.length&&r.from.some(x=>x.minPlayers<=game.players.length)).map(r=>{
  const from=r.from.filter(x=>x.minPlayers<=game.players.length),owned=from.some(x=>p.cards.some(c=>c.kind===x.kind)),built=p.cards.some(c=>c.kind===r.to.kind),inHand=game.hand.some(c=>c.kind===r.to.kind&&c.build?.plans[0]?.reason==='chain');
  return {...r,from,owned,built,inHand};
 }).filter(r=>filter==='all'||(filter==='ready'?r.inHand:r.owned));
 const node=(c,owned)=>`<span class="sw-chain-node sw-${c.color} ${owned?'sw-chain-node-owned':''}"><i>${['I','II','III'][c.age-1]}</i><b>${e(c.name)}</b>${owned?icon('check'):''}</span>`;
 return rows.map(r=>`<article class="sw-chain-route ${r.inHand?'sw-chain-route-ready':''}"><div>${r.from.map(c=>node(c,p.cards.some(x=>x.kind===c.kind))).join('<small class="sw-chain-or">或</small>')}</div><span class="sw-chain-bridge">${chainMark(r.symbol)}${icon('arrow')}</span>${node(r.to,r.built)}<span class="sw-chain-route-status">${r.built?'已建成':r.inHand?'手牌免费':r.owned?'已解锁':'未解锁'}</span></article>`).join('')||'<p class="sw-empty-city">暂无符合的连锁</p>';
}
