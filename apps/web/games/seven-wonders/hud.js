import {escapeHtml as e} from '../../ui.js';
import {icon,resourceNames,production,effectSymbols,scienceIcons,colorNames,colorIcons} from './symbols.js';

const count=(slots,key)=>slots.filter(slot=>slot===key).length;
export function resourceLedger(slots,{compact=false,gained=[]}={}) {
  return `<div class="sw-resource-ledger ${compact?'sw-ledger-compact':''}" role="group" aria-label="${compact?'可购买产能':'每回合产能'}">${Object.entries(resourceNames).map(([key,label])=>{
    const n=count(slots,key);
    return `<span class="sw-resource-cell ${n?'':'sw-resource-empty'} ${gained.some(slot=>slot.includes(key))?'sw-resource-gain':''}" title="${e(label)}：每回合 ${n}" aria-label="${e(label)}产能 ${n}">${icon(key)}<b>${n}</b><small>${label}</small></span>`;
  }).join('')}${slots.some(slot=>slot.length>1)?`<div class="sw-flex-production" aria-label="任选产能">${production(slots.filter(slot=>slot.length>1))}<small>任选</small></div>`:''}</div>`;
}
export function collectionBar(p) {
  return `<div class="sw-collection-bar" role="group" aria-label="已建建筑分类">${Object.entries(colorNames).map(([color,label])=>`<button type="button" data-action="game:collection" data-color="${color}" class="sw-collection-button sw-${color}" title="${label}建筑" aria-label="查看${label}建筑">${icon(colorIcons[color])}<b>${p.cards.filter(c=>c.color===color).length}</b><small>${label}</small></button>`).join('')}</div>`;
}
const delta=(symbol,label,before,after,extra='')=>`<div class="sw-delta ${before!==after?'sw-delta-changed':''}">${icon(symbol)}<span>${label}</span><span class="sw-delta-values"><s>${before}</s>${icon('arrow')}<b>${after}</b></span>${extra}</div>`;
export function outcomePreview(game,p,effect,preview,payment,mode) {
  const out=[],paid=payment?payment.left+payment.right+payment.bank:0;
  if(mode==='sell')return delta('coin','钱币',p.coins,p.coins+3);
  if(!preview)return `<div class="sw-ability-preview">${effectSymbols(effect)}</div>`;
  const rule=effect.scoring??effect.income;
  if(rule){const scope={own:'自己',neighbors:'左右邻国',all:'自己与两邻'}[rule.scope],target=rule.color==='stages'?'已建奇迹阶段':`${(Array.isArray(rule.color)?rule.color:[rule.color]).map(c=>colorNames[c]).join('／')}建筑`;out.push(`<div class="sw-condition-rule"><span>${scope} · ${target}</span><span>每${rule.color==='stages'?'阶段':'张'} ${effect.income?`${icon('coin')}${effect.income.coins}`:''}${effect.scoring?`${icon('points')}${effect.scoring.points}`:''}</span></div>`);}
  if(effect.complete)out.push(`<div class="sw-condition-rule"><span>完成全部奇迹</span><span>${icon('points')}${effect.complete}</span></div>`);
  const cash=p.coins-paid+preview.income;
  out.push(delta('coin','自身收支',p.coins,preview.incomeVariable?`≈ ${cash}`:cash,`<small title="不含邻国本轮向你支付的钱币；按当前公开城市估算收入">${preview.incomeVariable?'收入待揭晓':'揭晓后'}</small>`));
  if(effect.production){
    for(const key of [...new Set(effect.production.filter(slot=>slot.length===1))])out.push(delta(key,'每回合产能',count(p.production,key),count(preview.production,key)));
    const choices=effect.production.filter(slot=>slot.length>1);
    if(choices.length)out.push(`<div class="sw-delta sw-delta-changed">${icon('building')}<span>任选产能</span><span class="sw-new-production">${production(choices)}<b>+${choices.length} 组</b></span></div>`);
  }
  if(effect.shields){
    out.push(delta('shield','军力',p.shields,preview.shields));
    out.push(`<div class="sw-military-preview"><small>按当前军力</small>${game.neighbors.map((id,i)=>{const n=game.players.find(x=>x.id===id),r=preview.shields-n.shields;return `<span class="${r>0?'sw-winning':r<0?'sw-losing':''}">${i===0?'左邻':'右邻'} ${n.shields} ${r>0?'胜':r<0?'负':'平'}</span>`;}).join('')}</div>`);
  }
  if(Number.isInteger(effect.science)||effect.wild)out.push(delta('compass','科技计分',preview.scienceBefore,preview.science.points,`<small>${preview.science.counts.map((n,i)=>`${icon(scienceIcons[i])}${n}`).join(' ')}${preview.science.wild?' + 任选':''}</small>`));
  if(preview.pointsDelta||effect.scoring||effect.complete)out.push(`<div class="sw-delta ${preview.pointsDelta?'sw-delta-changed':''}">${icon('points')}<span>${effect.scoring||effect.complete?'按当前城市计分':'计分变化'}</span><strong class="sw-score-gain">${preview.pointsDelta>=0?'+':''}${preview.pointsDelta}</strong></div>`);
  if(effect.discount||effect.revive||effect.double||effect.freeColor||effect.freeFirst||effect.freeLast)out.push(`<div class="sw-ability-preview">${effectSymbols(effect)}<b>${effect.discount?'贸易优惠':effect.revive?'从弃牌免费建造':effect.double?'时代末额外行动':'免费建造能力'}</b></div>`);
  return out.join('');
}
export function chainDetails(c,p){
  if(!c.chains||!c.chains.from.length&&!c.chains.to.length)return '';
  return `<details class="sw-chain-detail"><summary>${icon('chain')}连锁建筑 <span>${c.chains.to.length?`${c.chains.to.length} 个后继`:''}</span></summary>${c.chains.from.length?`<div><small>前置</small>${c.chains.from.map(x=>`<span class="${p.cards.some(y=>y.kind===x.kind)?'sw-chain-owned':''}">${e(x.name)}${p.cards.some(y=>y.kind===x.kind)?icon('check'):''}</span>`).join('')}</div>`:''}${c.chains.to.length?`<div><small>后继</small>${c.chains.to.map(x=>`<span>${e(x.name)}<small>${['I','II','III'][x.age-1]}</small></span>`).join('')}</div>`:''}</details>`;
}
