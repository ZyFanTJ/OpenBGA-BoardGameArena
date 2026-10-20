import { escapeHtml as e } from '../../ui.js';

export const resourceNames = { w:'木', s:'石', c:'砖', o:'矿', g:'玻璃', p:'纸', t:'布' };
export const colorNames = { brown:'原料', grey:'制品', blue:'市政', yellow:'商业', red:'军事', green:'科技', purple:'行会' };
const paths = {
  tax:'<path d="M8 3h16v25l-4-3-4 3-4-3-4 3zM12 9h8m-8 5h8m-5 5h5M3 8v12m-3-3 3 3 3-3"/>',
  ship:'<path d="M3 23h26l-5 6H9zM16 3v19M13 5 5 19h8zm6 0v14h9zM2 31q4-3 8 0t8 0 8 0"/>',
  naval:'<path d="M16 3v22m-5-17h10M4 19q0 10 12 10t12-10M4 19l-2 4m26-4 2 4M16 25l-5-4m5 4 5-4"/><circle cx="16" cy="4" r="3"/>',
  island:'<path d="m2 25 7-9 6 4 5-6 10 11zM3 29h26M19 16V8m0 2-8-5 9 1 6-4-3 6 7 3z"/>',
  amphora:'<path d="M12 3h8v5l5 8-1 10-5 4h-6l-5-4-1-10 5-8zM8 11H3v10h5m17-10h4v10h-5M11 18h10"/>',
  w:'<path d="m6 12 12-7 8 5-12 7z"/><path d="M6 12v10l8 5V17m0 10 12-7V10M10 10l9 5M18 8l4 3"/>',
  s:'<path d="m5 14 6-7 13 1 4 12-10 7-13-4z"/><path d="m5 14 14 1 5-7m-5 7-1 12m1-12 9 5"/>',
  c:'<path d="M4 10h24v17H4zM4 18h24M14 10v8m8 0v9M4 10l5-5h19v5"/>',
  o:'<path d="m6 22 4-14 8-5 9 10-5 14-13-1zM10 8l5 13 7 6M15 21l12-8M18 3l-3 18"/>',
  g:'<path d="M12 4h8m-7 0v8L7 24l3 4h12l3-4-6-12V4M10 20h12M11 23h9"/>',
  p:'<path d="M9 7h16v21H9c-5 0-5-7 0-7h16M9 7c-5 0-5 7 0 7h3V7M15 12h6m-6 4h6m-6 4h6"/>',
  t:'<path d="m5 7 21-2 1 22-22-1zM11 6v20m6-21v22m6-22v22M5 12h22M5 18h22M5 23h22"/>',
  coin:'<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="8" opacity=".45"/><path d="M16 10v12m-3-9 3-3 3 3"/>',
  shield:'<path d="M6 5h20v13c-1 6-10 11-10 11S7 24 6 18zM16 6v20M7 13h18"/>',
  compass:'<circle cx="16" cy="8" r="3"/><path d="m14 11-7 17m11-17 7 17M9 22h14M16 3v2"/>',
  gear:'<path d="m12 4 1 4h6l1-4 5 3-2 4 3 5 4 1-1 6-5-1-4 4v4h-6l-1-5-5-3-4 2-3-5 4-3V11L2 8l4-4 4 3z"/><circle cx="16" cy="16" r="4"/>',
  tablet:'<rect x="7" y="3" width="19" height="26" rx="3"/><path d="M12 9h9m-9 5h9m-9 5h9m-9 5h5"/>',
  points:'<path d="M9 5C-1 16 5 27 14 29M23 5c10 11 4 22-5 24M5 10l5 2M4 17l6 1M7 24l5-1m15-13-5 2m6 5-6 1m3 6-5-1"/>',
  wonder:'<path d="M3 27 16 5l13 22zM10 27l6-11 6 11M2 28h28"/>',
  building:'<path d="m3 10 13-7 13 7zM4 28h24M7 12v12m6-12v12m6-12v12m6-12v12"/>',
  sell:'<path d="M5 22h10l5-5c2-2 5 1 3 3l-6 7H4M15 22l4-4c1-2-1-4-3-3l-5 3H4"/><circle cx="23" cy="7" r="5"/>',
  cards:'<rect x="8" y="4" width="17" height="24" rx="2"/><path d="M5 9H3v20h16v-1M13 10h7m-7 5h7m-7 5h5"/>',
  chain:'<path d="m13 8 3-3c8-7 17 4 10 10l-5 5c-4 3-8 1-10-2m8 6-3 3C8 34-1 23 6 17l5-5c4-3 8-1 10 2M11 21l10-10"/>',
  lock:'<rect x="6" y="14" width="20" height="15" rx="3"/><path d="M10 14V8a6 6 0 0 1 12 0v6M16 20v4"/>',
  check:'<path d="m6 16 7 7L27 8"/>',
  close:'<path d="m8 8 16 16M24 8 8 24"/>',
  left:'<path d="m20 6-10 10 10 10"/>',
  right:'<path d="m12 6 10 10-10 10"/>',
  arrow:'<path d="M4 16h24m-8-8 8 8-8 8"/>',
  help:'<circle cx="16" cy="16" r="12"/><path d="M12 11c0-6 10-6 9 0-1 3-5 3-5 7m0 5v1"/>',
  history:'<path d="M5 10a12 12 0 1 1-1 11M4 3v8h8M16 9v8l5 3"/>',
  sun:'<circle cx="16" cy="16" r="6"/><path d="M16 1v4m0 22v4M1 16h4m22 0h4M5 5l3 3m16 16 3 3M5 27l3-3M24 8l3-3"/>',
  moon:'<path d="M25 22A12 12 0 0 1 10 4a12 12 0 1 0 15 18z"/>',
  crown:'<path d="m4 8 6 6 6-10 6 10 6-6-3 18H7zM8 22h16"/>',
};

// Filled material symbols remain crisp in 16 px costs and match the painted card art.
Object.assign(paths, {
  w: '<g stroke="#62452e" stroke-width="1.2"><path fill="#9b693f" d="m5 10 13-6 9 4v9l-13 6-9-4z"/><path fill="#bd8950" d="m5 10 9 4 13-6M14 14v9"/><ellipse fill="#e1bd7f" cx="8" cy="12" rx="4.5" ry="5.5"/><ellipse fill="#e1bd7f" cx="21" cy="11" rx="4.5" ry="5.5"/><path fill="#a57243" d="m8 21 12-5 7 4v6l-12 5-7-4z"/><ellipse fill="#e6c58b" cx="12" cy="25" rx="4.5" ry="5.5"/><path fill="none" d="M7 10q5 2 1 5m12-6q4 2 1 5m-10 9q4 1 2 5"/></g>',
  s: '<g stroke="#5c6b6b" stroke-width="1.2"><path fill="#aab8b4" d="m4 11 10-7 13 5 2 13-12 7-13-6z"/><path fill="#e0e4d6" d="m4 11 13 6 10-8-13-5z"/><path fill="#8d9c9b" d="m17 17 12-8 0 13-12 7z"/><path fill="none" d="M17 17v12M7 16l6 3m9-8 2 5"/></g>',
  c: '<g stroke="#935333" stroke-width="1.1"><path fill="#cb8051" d="m2 20 12-4 10 4v8L12 31 2 27z"/><path fill="#e5a46a" d="m2 20 10 4 12-4-10-4z"/><path fill="#bc6c46" d="m12 24 12-4v8l-12 3z"/><path fill="#d58a55" d="m8 8 12-4 10 4v9l-12 4-10-4z"/><path fill="#efb57c" d="m8 8 10 4 12-4-10-4z"/><path fill="#bc6c46" d="m18 12 12-4v9l-12 4z"/></g>',
  o: '<g stroke="#35494e" stroke-width="1.2"><path fill="#627c83" d="m4 23 4-15 10-5 11 13-5 12-14 1z"/><path fill="#adc3bd" d="m8 8 10-5-3 15z"/><path fill="#354f58" d="m15 18 14-2-5 12-9-3z"/><path fill="#819b9d" d="m8 8 7 10-5 11-6-6z"/><path fill="none" d="m18 3 7 10-10 5 9 10"/><path stroke="#d4e1d7" d="m20 11 2 3m-10 9 1 3"/></g>',
  g: '<g stroke="#267c88" stroke-width="1.3"><path fill="#a8e3dc" d="M12 3h8v10l6 10q2 6-5 7H11q-7-1-5-7l6-10z"/><path fill="#59b8bf" d="m8 22 3-5h10l4 7q1 4-5 4h-8q-5 0-4-6z"/><path fill="none" stroke="#ecfff1" stroke-width="2" d="M15 8v6l-4 9"/><path fill="none" d="M11 3h10m-10 4h10"/></g>',
  p: '<g stroke="#ab884e" stroke-width="1.2"><path fill="#efdda6" d="M9 4h17v23H10C2 27 2 20 9 20h17"/><path fill="#fff0c0" d="M9 4C2 4 2 12 9 12h4V4z"/><path fill="#d0b77d" d="M9 20c-5 0-5 7 1 7h16v-4H10"/><path fill="none" d="M17 9h6m-6 4h6m-6 4h4"/><path stroke="#b76e59" stroke-width="3" d="M15 4v16"/></g>',
  t: '<g stroke="#795079" stroke-width="1.2"><path fill="#b189af" d="m6 5 20-2-2 12 4 10-20 5-4-10z"/><path fill="#d0acd0" d="m6 5 7 8 13-10-2 12-11 8-9-3z"/><path fill="#8f699b" d="m13 13 0 10 11-8 4 10-15 4z"/><path fill="none" stroke="#edcee2" d="m8 9 3 4m7-4 4-3m-7 15 6-4M8 26l-1 4m5-4v5m5-6 1 5m4-6 1 4"/></g>',
  coin: '<g stroke="#a77a2c" stroke-width="1.2"><circle fill="#e7bb58" cx="16" cy="16" r="13"/><circle fill="#f2d283" cx="16" cy="16" r="10"/><path fill="#b48b3f" stroke="none" d="M20 9c-9-5-14 7-8 11l-2 5h13l-4-7 3-2-2-2z"/><path fill="none" stroke="#fff0b3" d="M8 15a9 9 0 0 1 8-8M9 23l-2-3"/></g>',
  shield: '<g stroke="#986e36" stroke-width="1.3"><path fill="#d3b276" d="M5 4h22v14c-1 7-11 12-11 12S6 25 5 18z"/><path fill="#ac5a4b" d="M8 7h16v11c-1 4-8 9-8 9s-7-5-8-9z"/><path stroke="#e8c789" d="M16 7v19M8 14h16"/><circle fill="#ecd29b" cx="16" cy="14" r="3"/></g>',
  compass: '<g stroke="#747f68" stroke-width="1.2"><path fill="#e0c58a" d="m14 9-8 20 4-2 8-17z"/><path fill="#c5a767" d="m18 9 8 20-4-2-8-17z"/><circle fill="#f1dfb1" cx="16" cy="8" r="4"/><path fill="none" stroke="#8c9c73" d="M8 21h16M16 2v2"/></g>',
  gear: '<g stroke="#7b714a" stroke-width="1.1"><path fill="#c6ac6d" d="m13 2 6 0 1 4 3 2 4-1 3 5-3 3v3l3 3-3 5-4-1-3 2-1 4h-6l-1-4-3-2-4 1-3-5 3-3v-3l-3-3 3-5 4 1 3-2z"/><circle fill="#f2e3bb" cx="16" cy="16" r="7"/><circle fill="#85936d" cx="16" cy="16" r="4"/><path stroke="#e6cf91" d="M13 5h5M7 12l3-2m11 0 3 2m-3 12 3-3M8 22l2 2"/></g>',
  tablet: '<g stroke="#8c7952" stroke-width="1.2"><rect fill="#c8b17e" x="6" y="3" width="20" height="27" rx="4"/><path fill="#e4d09e" d="M9 6h14v20H9z" stroke="none"/><path fill="#8c7952" stroke="none" d="m11 9 3 1-2 3zm6 0 4 1-3 3zm-6 7 5 1-3 3zm7 0 4 1-2 3zm-7 6 4 1-3 2z"/></g>',
});

export function icon(key, label='', extra='') {
  return `<svg class="sw-icon ${extra}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${label?`role="img" aria-label="${e(label)}"><title>${e(label)}</title>`:'aria-hidden="true">'}${paths[key]??paths.cards}</svg>`;
}
export const scienceIcons=['compass','gear','tablet'];
export const colorIcons={brown:'w',grey:'g',blue:'points',yellow:'coin',red:'shield',green:'compass',purple:'crown'};
export function resource(key, count=1, labeled=false) {
  return `<span class="sw-token sw-token-${key}" title="${e(resourceNames[key])}${count>1?` ×${count}`:''}">${icon(key)}${labeled?`<small>${resourceNames[key]}</small>`:''}${count>1?`<b>${count}</b>`:''}</span>`;
}
export function production(slots, labeled=false) {
  const grouped=new Map();
  for(const slot of slots){const key=[...slot].sort().join('');grouped.set(key,(grouped.get(key)??0)+1);}
  return [...grouped].map(([slot,count])=>slot.length===1?resource(slot,count,labeled):`<span class="sw-option-resource" title="${[...slot].map(r=>resourceNames[r]).join(' / ')}，任选一种">${[...slot].map(r=>resource(r)).join('<i>/</i>')}${count>1?`<b>×${count}</b>`:''}</span>`).join('');
}
export function costSymbols(cost) {
  const slots=[...cost.resources];
  return `${cost.age?`<span class="sw-symbol-value" title="费用为当前时代数">${icon('coin')}<b>I / II / III</b></span>`:cost.coins?`<span class="sw-symbol-value">${icon('coin')}<b>${cost.coins}</b></span>`:''}${production(slots)}`;
}
const value=(key,n)=>`<span class="sw-symbol-value">${icon(key)}<b>${n}</b></span>`;
function scopeMark(scope) { const label={own:'自己',neighbors:'左右邻国',all:'自己与左右邻国'}[scope]??'自己'; return `<span class="sw-scope-cities" title="${label}" role="img" aria-label="统计${label}">${[0,1,2].map(i=>`<i class="${scope==='all'||scope==='neighbors'&&i!==1||scope==='own'&&i===1?'sw-counted-city':''}">${icon('building')}</i>`).join('')}</span>`; }
function target(color) {return color==='stages'?icon('wonder'):Array.isArray(color)?color.map(c=>`<span class="sw-color-dot sw-${c}" title="${colorNames[c]}">${icon(colorIcons[c])}</span>`).join(''):`<span class="sw-color-dot sw-${color}" title="${colorNames[color]}">${icon(colorIcons[color])}</span>`;}
export function effectSymbols(effect) {
  const out=[];
  if(effect.production)out.push(production(effect.production));
  if(effect.points)out.push(value('points',effect.points));
  if(effect.coins)out.push(value('coin',`+${effect.coins}`));
  if(effect.shields)out.push(value('shield',effect.shields));
  if(Number.isInteger(effect.science))out.push(icon(scienceIcons[effect.science]));
  if(effect.wild)out.push(`<span class="sw-science-wild">${scienceIcons.map(s=>icon(s)).join('')}<b>?</b></span>`);
  if(effect.discount)out.push(`<span class="sw-trade-effect">${effect.discount==='left'?'‹':effect.discount==='goods'?'‹':''}${effect.discount==='goods'?production(['g','p','t']):production(['w','s','o','c'])}${effect.discount!=='left'?'›':''}<span>${icon('coin')}<b>1</b></span></span>`);
  const rule=effect.scoring??effect.income;
  if(rule)out.push(`<span class="sw-count-effect"><span class="sw-effect-condition">${scopeMark(rule.scope)}<span class="sw-count-target">${target(rule.color)}</span></span><span class="sw-effect-reward"><span class="sw-multiply">×</span>${effect.income?value('coin',effect.income.coins):''}${effect.scoring?value('points',effect.scoring.points):''}</span></span>`);
  if(effect.complete)out.push(`<span class="sw-complete-effect">${icon('wonder')}${icon('check')}${value('points',effect.complete)}</span>`);
  if(effect.revive)out.push(`<span class="sw-special-effect">${icon('history')}${icon('building')}</span>`);
  if(effect.double)out.push(`<span class="sw-special-effect">${icon('cards')}<b>+1</b></span>`);
  if(effect.freeColor)out.push(`<span class="sw-free-effect"><span class="sw-rainbow">${Object.keys(colorNames).map(c=>`<i class="sw-${c}"></i>`).join('')}</span><b>0</b>${icon('coin')}</span>`);
  if(effect.freeFirst||effect.freeLast)out.push(`<span class="sw-free-effect"><b>${effect.freeFirst?'1':effect.freeLastAt??6}</b>${icon('cards')}<b>0</b>${icon('coin')}</span>`);
  if(effect.naval)out.push(value('naval',effect.naval));
  if(effect.advance||effect.advanceColor)out.push(`<span class="sw-advance-effect ${effect.advanceColor?'sw-'+effect.advanceColor:''}">${icon('ship')}${icon('arrow')}<b>${effect.advance??1}</b></span>`);
  if(effect.drawIsland||effect.explore)out.push(value('island',['I','II','III'][(effect.drawIsland??effect.explore)-1]));
  if(effect.tax)out.push(value('tax',effect.tax));
  if(effect.pirate)out.push(`${icon('amphora')}${icon('sell')}`);
  if(effect.taxShield)out.push(`${icon('amphora')}${icon('shield')}`);
  if(effect.commercialPoints)out.push(`${icon('amphora')}×${value('points',effect.commercialPoints)}`);
  if(effect.majorityScience)out.push(`<span class="sw-majority-science">${scienceIcons.map(key=>icon(key)).join('')}<b>+1 MAX</b></span>`);
  if(effect.scienceChange)out.push(`${icon('compass')}${icon('arrow')}${icon('gear')}`);
  if(effect.scienceSet)out.push(`${icon('compass')}${value('points',`+${effect.scienceSet}`)}`);
  if(effect.farTrade)out.push(`<span>${effect.farTrade.side==='left'?'‹‹':''}${icon('coin')}<b>1 ×${effect.farTrade.limit}</b>${effect.farTrade.side==='right'?'››':''}</span>`);
  if(effect.boarding)out.push(`${effect.boarding==='left'?'‹‹':''}${icon('shield')}${effect.boarding==='right'?'››':''}`);
  if(effect.advanceCoins)out.push(`${icon('ship')}×${value('coin',1)}`);
  if(effect.wonderAdvance)out.push(`${icon('wonder')}${icon('arrow')}${icon('ship')}`);
  if(effect.reduceNaval)out.push(`${icon('ship')}<b>−1</b>${icon('building')}`);
  if(effect.navalChoice)out.push(`${icon('naval')}<b>?</b>`);
  if(effect.islandPoints)out.push(`${icon('island')}×${value('points',effect.islandPoints)}`);
  if(effect.maxColorPoints)out.push(`${icon('cards')}<b>MAX</b>${value('points',1)}`);
  if(effect.freeLeaders)out.push(`${icon('crown')}<b>0</b>${icon('coin')}`);
  if(effect.freePurple)out.push(`${target('purple')}<b>0</b>${icon('coin')}`);
  if(effect.reduceColor||effect.reduceWonder)out.push(`${effect.reduceColor?target(effect.reduceColor):icon('wonder')}<b>−1</b>${icon('building')}`);
  if(effect.bankResource)out.push(`${icon('building')}${value('coin',1)}<b>1×</b>`);
  if(effect.stagePoints)out.push(`${icon('wonder')}×${value('points',effect.stagePoints)}`);
  if(effect.leaderColorPoints)out.push(`${target(effect.leaderColorPoints.color)}×${value('points',effect.leaderColorPoints.points)}`);
  if(effect.colorSet)out.push(`<span class="sw-color-set">${effect.colorSet.colors.map(c=>target(c)).join('')}${value('points',effect.colorSet.points)}</span>`);
  if(effect.victoryPoints||effect.victoryPairs)out.push(`${icon('shield')}×${value('points',effect.victoryPoints??'?')}`);
  if(effect.treasuryBonus)out.push(`${value('coin',3)}×${value('points',effect.treasuryBonus)}`);
  if(effect.yellowCoins)out.push(`${target('yellow')}${value('coin',`+${effect.yellowCoins}`)}`);
  if(effect.chainCoins)out.push(`${icon('chain')}${value('coin',`+${effect.chainCoins}`)}`);
  if(effect.bankBonus||effect.tradeRefund)out.push(`${icon(effect.tradeRefund?'arrow':'building')}${value('coin','+1')}`);
  if(effect.onlyLeader)out.push(`${icon('crown')}<b>1×</b>${value('points',7)}`);
  if(effect.noDefeat)out.push(`${icon('shield')}${icon('check')}${value('points',6)}`);
  if(effect.majority)out.push(`${effect.majority==='coins'?icon('coin'):target(effect.majority)}<b>›</b>${value('points',5)}`);
  if(effect.victoryToken)out.push(`${icon('shield')}<b>+ I / II / III</b>`);
  if(effect.removeDefeats)out.push(`${icon('shield')}${icon('close')}`);
  if(effect.reflectDefeat)out.push(`${icon('shield')}${icon('arrow')}`);
  if(effect.drawLeaders)out.push(`${icon('crown')}<b>+${effect.drawLeaders}</b>`);
  if(effect.recruitExtra)out.push(`${icon('crown')}<b>+1</b>`);
  if(effect.mummify)out.push(`${icon('crown')}${icon('wonder')}<b>×2</b>`);
  return out.join('');
}
