import {playerName} from '../../player-identity.js';
import {escapeHtml as e} from '../../ui.js';
import {icon,production,effectSymbols,colorNames,colorIcons,scienceIcons} from './symbols.js';

export function tableOverview(snapshot,viewerId){
  const s=snapshot.game,name=id=>snapshot.players.find(p=>p.id===id)?.name??'玩家';
  const metric=(key,value,label)=>`<span title="${label}" aria-label="${label} ${value}">${icon(key)}<b>${value}</b></span>`;
  return `<div class="sw-overview-heading"><div><small>时代 ${['I','II','III'][s.age-1]} · ${s.round} / ${s.turnsPerAge??6}</small><h2>全桌状态</h2></div><span>公开信息</span></div><div class="sw-overview-players">${s.players.map(p=>{
    const score=s.scores.find(x=>x.id===p.id),ready=p.actionStatus==='confirmed',status=ready?'已确认':p.actionStatus==='inactive'?'无需操作':'待操作';
    return `<article class="sw-overview-player ${ready?'sw-overview-ready':''} ${p.id===viewerId?'sw-overview-self':''}" data-player="${e(p.id)}"><header><div><b>${playerName(snapshot,p.id)}${p.id===viewerId?'<small>你</small>':s.neighbors.includes(p.id)?`<small>${s.neighbors[0]===p.id?'左邻':'右邻'}</small>`:''}</b><span>${e(p.wonderName)} · ${p.stages}/${p.stageList.length}</span></div><strong>${ready?icon('check'):''}${status}</strong></header><div class="sw-overview-metrics">${metric('coin',p.coins,'钱币')}${metric('shield',p.shields,'军力')}${p.fleets?metric('naval',p.naval,'海军')+metric('amphora',p.commercial,'商业等级'):''}${metric('points',score?.total??0,'当前计分')}</div><div class="sw-overview-production" aria-label="每回合产能">${production(p.production)||'—'}</div><div class="sw-overview-colors" aria-label="已建建筑">${Object.keys(colorNames).map(color=>`<span class="sw-${color}" title="${colorNames[color]}">${icon(colorIcons[color])}<b>${p.cards.filter(c=>c.color===color).length}</b></span>`).join('')}</div><div class="sw-overview-science">${scienceIcons.map((key,i)=>metric(key,score?.science.counts[i]??0,['圆规','齿轮','石板'][i])).join('')}${score?.science.wild?`<span title="任选科技">+${score.science.wild} ?</span>`:''}</div>${p.fleets?`<div class="sw-overview-fleets">${Object.entries(p.fleets).map(([color,pos])=>`<span class="sw-${color}" title="${({red:'战舰',yellow:'商船',blue:'民用船',green:'探险船'})[color]}">${icon('ship')}${pos}/6</span>`).join('')}</div>`:''}${[...(p.leaders??[]),...(p.islands??[])].length?`<div class="sw-overview-assets">${[...(p.leaders??[]),...(p.islands??[])].map(c=>`<span title="${e(c.text)}">${icon(c.color==='white'?'crown':'island')}<b>${e(c.name)}</b><i>${effectSymbols(c.effect)}</i></span>`).join('')}</div>`:''}</article>`;
  }).join('')}</div>`;
}

// The peek does not move focus, rerender the hand, or intercept form/modal navigation.
export function createTablePeek(){
  let container=null,held=false;
  const hide=()=>{held=false;const el=container?.querySelector('.sw-peek');if(el?.matches(':popover-open'))el.hidePopover();};
  const down=event=>{
    if(event.key==='Escape'){hide();return;}
    if(event.key!=='Tab'||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')||document.querySelector('dialog[open]'))return;
    const el=container?.querySelector('.sw-peek');if(!el)return;
    event.preventDefault();held=true;if(!el.matches(':popover-open'))el.showPopover();
  };
  const up=event=>{if(event.key==='Tab')hide();};
  const visibility=()=>{if(document.hidden)hide();};
  return {
    attach(next){
      if(!container){document.addEventListener('keydown',down);document.addEventListener('keyup',up);window.addEventListener('blur',hide);document.addEventListener('visibilitychange',visibility);}
      container=next;
      if(held){const el=container.querySelector('.sw-peek');if(el&&!el.matches(':popover-open'))el.showPopover();}
    },
    hide,
    dispose(){hide();document.removeEventListener('keydown',down);document.removeEventListener('keyup',up);window.removeEventListener('blur',hide);document.removeEventListener('visibilitychange',visibility);container=null;},
  };
}
