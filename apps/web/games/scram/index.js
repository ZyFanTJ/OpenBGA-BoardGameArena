import {createScramMotion} from './motion.js';
import {escapeHtml as e} from '../../ui.js';
import {playerAvatar,playerName} from '../../player-identity.js';
import {resultActions} from '../../result-actions.js';
import {roundWaiting} from '../../round-waiting.js';
import {cardArt,abilities} from './art.js';
import {guide} from './guide.js';
const teamNames=['松林队','篝火队'];
const b=(text,action,disabled=false,attrs='')=>`<button type="button" data-action="game:${action}" ${disabled?'disabled':''} ${attrs}>${text}</button>`;
const key=r=>JSON.stringify([r.playerId,r.slot]);
export function createScramRenderer(send,rerender) {
  let room,user,selected=[],mode='replace',side='right',insertSlot=null,windowKey='',showGuide=false,busy=false,error='',root;
  const name=id=>room.players.find(p=>p.id===id)?.name??'玩家';
  function render(snapshot,me) {
    room=snapshot;user=me;const s=room.game,own=s.players.find(p=>p.id===me.id),ended=['roundEnd','finished'].includes(s.phase);
    const current=`${room.matchId}:${s.round}:${s.sequence}`;
    if(current!==windowKey){selected=[];insertSlot=null;mode='replace';windowKey=current;error='';}
    const active=s.legal.act&&!busy&&!room.dissolution,drawn=s.drawn?.value;
    const count=[6,8,9,11,12].includes(drawn)?2:1;
    const selectable=(playerId,slot)=>active&&s.phase==='drawn'&&(playerId!==null||slot<s.deckCount)&&(mode==='ability'?drawn!==13&&(playerId!==null||slot===0||drawn!==11):playerId!==null&&s.players.find(p=>p.id===playerId).team===own.team);
    const card=(value,ref,faceUp=false)=>{const picked=selected.some(r=>key(r)===key(ref));const reveal=s.reveal?.reveals.find(r=>key(r)===key(ref));return `<button type="button" class="sc-card ${picked?'sc-selected':''} ${reveal?'sc-peeking':''}" data-sc-ref="${e(key(ref))}" data-action="game:card" data-player="${e(ref.playerId??'')}" data-slot="${ref.slot}" aria-pressed="${picked}" aria-label="${ref.playerId===null?'牌库':e(name(ref.playerId))} 第 ${ref.slot+1} 张，${reveal?.value??value??'暗牌'}${faceUp?'，公开':''}" ${selectable(ref.playerId,ref.slot)?'':'disabled'}>${cardArt(reveal?.value??value)}<span class="sc-slot">${ref.slot+1}${faceUp?' · 明':''}${reveal?' · 仅你可见':''}</span></button>`;};
    const order=[...s.players],anchor=order.findIndex(p=>p.id===me.id);if(anchor>0)order.push(...order.splice(0,anchor));
    const seats=order.map((p,i)=>`<section class="sc-seat sc-seat-${i} sc-team-${p.team} ${p.id===s.turnId&&!ended?'sc-active':''}" data-player-id="${e(p.id)}"><div class="sc-player">${playerAvatar(room,p.id,'sc-avatar')}<div>${playerName(room,p.id)}${p.id===me.id?'<small>你</small>':''}<span>${teamNames[p.team]}${s.caller===p.id?' · 开溜！':''}</span></div><b>${p.cards.length}<small>张</small></b></div><div class="sc-hand">${p.cards.map(c=>card(c.value,{playerId:p.id,slot:c.slot},c.faceUp)).join('')||'<span class="sc-empty">营地已清空</span>'}</div>${active&&s.phase==='drawn'&&mode==='ability'&&drawn===13?b('把 13 放到这里','recipient',false,`data-player="${e(p.id)}"`):''}</section>`).join('');
    let help=ended?'所有营地已翻牌':room.dissolution?'解散投票中，牌局暂时停下':s.turnId!==me.id?`等待 ${name(s.turnId)} 行动`:s.phase==='turn'?'轮到你 · 抽一张牌，或在营地不超过两张时喊开溜':s.phase==='reveal'?'仅你可见 · 记住这些牌，再确认结束':mode==='replace'?'先选自己的一张牌，再选自己或队友的同值牌':drawn===13?'选择一个营地，把 13 明置于该营地一端':`选择 ${count} 张牌 · ${abilities[drawn]}`;
    let controls='';
    if(s.legal.draw) controls=b('抽牌库','deck',!active,'class="sc-primary"')+b('拿弃牌','discardPile',!active||!s.legal.discardDraw)+b('开溜！','scram',!active||!s.legal.scram,'class="sc-call"');
    if(s.phase==='drawn'&&s.legal.act){
      controls=`<div class="sc-modes">${b('替换营地牌','replaceMode',!active||!own.cards.length,`aria-pressed="${mode==='replace'}"`)}${s.drawn.source==='deck'?b('使用技能','abilityMode',!active||!Number.isInteger(drawn)||drawn<5,`aria-pressed="${mode==='ability'}"`)+b('直接弃掉','discard',!active):''}</div>`;
      if(mode==='replace'||[9,13].includes(drawn)) controls+=`<span class="sc-side">新增牌放在 ${b('左端','left',!active,`aria-pressed="${side==='left'}"`)}${b('右端','right',!active,`aria-pressed="${side==='right'}"`)}</span>`;
      if(mode==='replace'&&selected.filter(r=>r.playerId===me.id).length>1)controls+=`<div class="sc-insert">成功后新牌放回 ${selected.filter(r=>r.playerId===me.id).map(r=>b(`第 ${r.slot+1} 格`,'insert',!active,`data-slot="${r.slot}" aria-pressed="${(insertSlot??selected[0]?.slot)===r.slot}"`)).join('')}</div>`;
      if(!(mode==='ability'&&drawn===13))controls+=b(mode==='replace'?`确认替换（${selected.length} 张）`:'执行技能','confirm',!active||(mode==='replace'?!selected.length:selected.length!==count),'class="sc-primary"');
      controls+=b('清空选择','clear',!active||!selected.length);
    }
    if(s.phase==='reveal'&&s.legal.act)controls=b('记住了 · 结束回合','resolve',!active,'class="sc-primary"')+(s.reveal.value===12?b('交换这两张牌','swap',!active):'');
    const result=ended?`<section class="sc-result"><small>${s.phase==='finished'?'MATCH COMPLETE':'ROUND COMPLETE'}</small><h2>${s.phase==='finished'?(s.winners.length?`${teamNames[s.players.find(p=>p.id===s.winners[0]).team]}获胜`:'小动物占领营地 · 全员落败'):'本轮结算'}</h2><div class="sc-score-grid">${s.totals.map((total,t)=>`<article><span>${teamNames[t]}</span><strong>${total}<small>累计罚分</small></strong><p>营地 ${s.roundResult.raw[t]} → 本轮 +${s.roundResult.points[t]}</p></article>`).join('')}</div><p>${s.roundResult.callerTeam===null?'牌库耗尽，按营地分数计分':`${teamNames[s.roundResult.callerTeam]}喊开溜${s.roundResult.points[s.roundResult.callerTeam]===0?'成功，本轮零分':'失败，额外加 10 分'}`}</p>${s.phase==='roundEnd'?(room.hostId===me.id?b('开始下一轮','nextRound',busy||!!room.dissolution,'class="sc-primary"'):roundWaiting(room)):resultActions(room,me)}</section>`:'';
    return `<section class="sc-game"><header class="sc-toolbar"><div><small>WOODLAND CAMPSITE</small><h1>开溜！<em>SCRAM!</em></h1></div><span>第 ${s.round} / ${s.rounds} 轮</span>${b('玩法手卡','guide')}</header><div class="sc-scorebar">${s.totals.map((n,t)=>`<span class="sc-team-${t}">${teamNames[t]} <b>${n}</b> 分${own?.team===t?' · 你的队伍':''}</span>`).join('')}</div>${s.caller&&!ended?`<div class="sc-final" role="status">${e(name(s.caller))} 喊了开溜 · 最后 ${1+(s.remaining?.length??0)} 次行动</div>`:''}<div class="sc-table sc-count-${order.length}"><div class="sc-felt" aria-hidden="true"><span>SCRAM!</span><small>把森林还给夜晚</small></div>${seats}<div class="sc-piles"><div>${s.phase==='drawn'&&mode==='ability'?card(s.deckTop,{playerId:null,slot:0}):`<button class="sc-card" data-action="game:deck" aria-label="从牌库抽牌" ${s.legal.draw&&active?'':'disabled'}>${cardArt(s.deckTop)}</button>`}<span>牌库 · ${s.deckCount}</span></div><div><button class="sc-card" data-action="game:discardPile" aria-label="拿取弃牌" ${s.legal.discardDraw&&active?'':'disabled'}>${s.discardTop===null?'<span class="sc-empty">空</span>':cardArt(s.discardTop)}</button><span>弃牌</span></div>${s.phase==='drawn'&&s.drawn?`<div class="sc-drawn"><div class="sc-card">${cardArt(drawn)}</div><span>${s.drawn.source==='deck'?'刚抽到 · 仅你可见':'拿到的弃牌'}</span></div>`:''}${active&&s.phase==='drawn'&&mode==='ability'&&[6,8,9,12].includes(drawn)&&s.deckCount>1?`<div>${card(null,{playerId:null,slot:1})}<span>牌库第二张</span></div>`:''}</div></div><div class="sc-decision"><p role="status">${e(help)}</p>${s.phase==='reveal'&&s.legal.act?`<div class="sc-reveals">${s.reveal.reveals.map(r=>`<div><span class="sc-card">${cardArt(r.value)}</span><small>${r.playerId===null?'牌库':e(name(r.playerId))} · 第 ${r.slot+1} 张</small></div>`).join('')}</div>`:''}<div class="sc-controls">${controls}</div>${error?`<p class="sc-error" role="alert">${e(error)}</p>`:''}<small class="sc-event">${e(s.lastAction)}</small></div>${result}${showGuide?`<div class="sc-overlay"><section class="sc-guide-dialog" role="dialog" aria-modal="true" aria-label="开溜玩法手卡">${b('关闭手卡','guide',false,'class="sc-close"')}${guide()}</section></div>`:''}</section>`;
  }
  async function handle(action,el) {
    if(action==='guide'){showGuide=!showGuide;rerender();root?.querySelector(showGuide?'.sc-close':'[data-action="game:guide"]')?.focus();return;}
    if(busy||motion.busy||room?.dissolution)return;
    if(action==='replaceMode'||action==='abilityMode'){mode=action==='replaceMode'?'replace':'ability';selected=[];insertSlot=null;rerender();return;}
    if(action==='clear'){selected=[];insertSlot=null;rerender();return;}
    if(action==='left'||action==='right'){side=action;rerender();return;}
    if(action==='insert'){insertSlot=Number(el.dataset.slot);rerender();return;}
    if(action==='card'){
      const ref={playerId:el.dataset.player||null,slot:Number(el.dataset.slot)},i=selected.findIndex(r=>key(r)===key(ref));
      if(i>=0){selected.splice(i,1);if(mode==='replace'&&selected[0]?.playerId!==user.id)selected=[];insertSlot=null;}
      else if(mode==='replace'&&!selected.length&&ref.playerId!==user.id){error='第一张必须选择自己营地的牌';rerender();return;}
      else{selected.push(ref);if(mode==='ability'){const count=[6,8,9,11,12].includes(room.game.drawn?.value)?2:1;selected=selected.slice(-count);}}
      error='';rerender();return;
    }
    let command;
    if(action==='deck'||action==='discardPile')command={type:'draw',source:action==='deck'?'deck':'discard'};
    if(['scram','discard','nextRound'].includes(action))command={type:action};
    if(action==='resolve'||action==='swap')command={type:'resolve',swap:action==='swap'};
    if(action==='recipient')command={type:'ability',playerId:el.dataset.player,side};
    if(action==='confirm')command={type:mode==='replace'?'replace':'ability',targets:selected,side,...(mode==='replace'&&insertSlot!==null?{insertSlot}:{})};
    if(!command)return;
    busy=true;error='';rerender();try{await send(command);}catch(err){error=err.message??'行动未提交，请重试';}finally{busy=false;rerender();}
  }
  function keyboard(event){if(!showGuide)return;if(event.key==='Escape'){showGuide=false;rerender();root?.querySelector('[data-action="game:guide"]')?.focus();}if(event.key==='Tab'){const els=[...root.querySelectorAll('.sc-guide-dialog button,.sc-guide-dialog a')],first=els[0],last=els.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}}
  function paint(el,snapshot,me){if(root!==el){root?.removeEventListener('keydown',keyboard);el.addEventListener('keydown',keyboard);root=el;}const focus=el.contains(document.activeElement)?document.activeElement:null,action=focus?.dataset.action,slot=focus?.dataset.slot,player=focus?.dataset.player,offset=el.querySelector('.sc-guide-dialog')?.scrollTop;el.innerHTML=render(snapshot,me);if(offset!==undefined&&el.querySelector('.sc-guide-dialog'))el.querySelector('.sc-guide-dialog').scrollTop=offset;if(action)[...el.querySelectorAll('button:not(:disabled)')].find(b=>b.dataset.action===action&&b.dataset.slot===slot&&b.dataset.player===player)?.focus({preventScroll:true});}
  const motion=createScramMotion(paint);
  return {render,handle,update:(...args)=>motion.update(...args),dispose(){motion.dispose();root?.removeEventListener('keydown',keyboard);root=null;}};
}
