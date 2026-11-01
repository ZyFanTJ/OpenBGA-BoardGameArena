import {escapeHtml as e} from '../../ui.js';
const suits={s:['♠','黑桃'],h:['♥','红桃'],c:['♣','梅花'],d:['♦','方块']};
export const cardLabel=c=>c?`${suits[c.suit][1]}${({11:'J',12:'Q',13:'K',14:'A'})[c.rank]??c.rank}`:'未公开的牌';
export function card(c,{highlight=false,empty=false}={}){
  if(empty)return '<span class="th-card th-empty" aria-label="待发公共牌"><span>✧</span></span>';
  if(!c)return '<span class="th-card th-back" role="img" aria-label="未公开的牌"><img src="/assets/texas-holdem/card-back.svg" alt="" width="80" height="112"></span>';
  const rank=({11:'J',12:'Q',13:'K',14:'A'})[c.rank]??c.rank,suit=suits[c.suit][0];
  return `<span class="th-card th-suit-${c.suit} ${highlight?'th-winning-card':''}" role="img" aria-label="${e(cardLabel(c))}"><span class="th-card-corner"><b>${rank}</b><span>${suit}</span></span><span class="th-card-suit">${suit}</span><span class="th-card-corner th-card-bottom"><b>${rank}</b><span>${suit}</span></span></span>`;
}
export const chips=()=>'<img class="th-chips" src="/assets/texas-holdem/chips.svg" alt="" width="52" height="40">';
