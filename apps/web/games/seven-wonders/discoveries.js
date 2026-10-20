import {escapeHtml as e} from '../../ui.js';
import {icon,effectSymbols} from './symbols.js';

// Reading preferences are local to this viewer and match, outside authoritative state.
export function createDiscoveryTracker(storage) {
  let scope='',seen=new Set();
  const save=()=>{try{(storage??globalThis.sessionStorage)?.setItem(scope,JSON.stringify([...seen]));}catch{}};
  return {
    pending(snapshot,viewerId){
      const cards=snapshot.game.players.find(p=>p.id===viewerId)?.islands??[];
      const key=`moon:7w:islands:${snapshot.id}:${snapshot.matchId??'preview'}:${viewerId}`;
      if(key!==scope){
        scope=key;let saved=null;
        try{saved=JSON.parse((storage??globalThis.sessionStorage)?.getItem(scope)??'null');}catch{}
        seen=new Set(Array.isArray(saved)?saved.filter(x=>typeof x==='string'):cards.map(c=>c.id));save();
      }
      const unread=cards.filter(c=>!seen.has(c.id));
      return unread.length?{type:'discovery',cards:unread}:null;
    },
    dismiss(cards){cards.forEach(c=>seen.add(c.id));save();},
  };
}

export function islandSummary(cards,playerId){
  if(!cards?.length)return '';
  return `<div class="sw-island-summary" aria-label="已获得岛屿">${cards.map(c=>`<button type="button" data-action="game:expansion-city" data-player="${e(playerId)}" title="${e(c.text)}" aria-label="${e(c.name+'，'+c.text)}"><span>${icon('island')}<b>${e(c.name)}</b><small>${['I','II','III'][c.level-1]}</small></span><span class="sw-island-benefit">${effectSymbols(c.effect)}</span></button>`).join('')}</div>`;
}

export function discoveryDialog(cards,cardFace){
  return `<dialog data-surface="discovery" class="sw-dialog sw-discovery-dialog" aria-labelledby="sw-discovery-title"><div class="sw-drawer-heading"><div><span>航海发现</span><h2 id="sw-discovery-title">${cards.length>1?'发现新的岛屿':'发现新岛屿'}</h2></div><button type="button" data-action="game:close" class="sw-close" aria-label="收下岛屿">${icon('close')}</button></div><div class="sw-discovery-cards">${cards.map(c=>`<article>${cardFace(c,{interactive:false,availability:false})}<p>${e(c.text)}</p></article>`).join('')}</div><button type="button" class="sw-primary" data-action="game:close">收下岛屿 ${icon('check')}</button></dialog>`;
}
