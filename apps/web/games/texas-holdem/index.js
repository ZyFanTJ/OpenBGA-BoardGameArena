import {escapeHtml as e} from '../../ui.js';
import {playerName,playerAvatar,playerTurnClass} from '../../player-identity.js';
import {resultActions} from '../../result-actions.js';
import {card,chips} from './art.js';
import {guide} from './guide.js';

const streetNames={preflop:'翻牌前',flop:'翻牌',turn:'转牌',river:'河牌'};
const actionNames={fold:'弃牌',check:'过牌',call:'跟注',raise:'加注',allIn:'全押',refund:'退回',deal:'开始发牌',flop:'发出翻牌',turn:'发出转牌',river:'发出河牌',showdown:'摊牌结算',uncontested:'其余玩家弃牌'};
const n=v=>Number(v).toLocaleString('zh-CN');
const b=(label,action,disabled=false,attrs='')=>`<button type="button" data-action="game:${action}" ${disabled?'disabled':''} ${attrs}>${label}</button>`;
export function createHoldemRenderer(send,rerender){
 let room,user,container,panel='',amount=null,confirm=null,busy=false,error='',windowKey='',focusPanel=false;
 const name=id=>room.players.find(p=>p.id===id)?.name??'玩家';
 function render(snapshot,me){
  if(!me)return '<p class="game-loading" role="status">登录已失效，请重新登录后返回牌桌。</p>';
  room=snapshot;user=me;const s=room.game,l=s.legal,self=s.players.find(p=>p.id===me.id),ended=s.phase!=='betting',mine=s.turnId===me.id;
  const key=`${room.matchId}:${s.handNumber}:${s.sequence}`;
  if(key!==windowKey){amount=l.minRaiseTo;confirm=null;error='';windowKey=key;}
  const paused=!!room.dissolution,disabled=busy||paused;
  const order=[...s.players],own=order.findIndex(p=>p.id===me.id);if(own>0)order.push(...order.splice(0,own));
  const result=s.roundResult,ownBest=result?.players.find(p=>p.id===me.id)?.best?.cards??[];
  const isBest=c=>ownBest.some(x=>x.rank===c.rank&&x.suit===c.suit);
  const prompt=paused?'解散投票中，牌局暂时停下':ended?s.phase==='finished'?'本场已结束':`第 ${s.handNumber} 手已结算`:mine?l.check?'轮到你 · 可以过牌，或主动下注':`轮到你 · 跟注需 ${n(l.callAmount)} 筹码`:self?.out?'你已完成比赛，可继续观看同桌':self?.folded?'本手已弃牌 · 等待下一手':`等待 ${name(s.turnId)} 行动`;
  const seats=order.map((p,i)=>`<article class="th-seat th-seat-${i} ${playerTurnClass(room,p.id)} ${s.turnId===p.id?'th-active':''} ${p.folded?'th-folded':''} ${p.out?'th-out':''}" data-player-id="${e(p.id)}" aria-label="${e(name(p.id))}，${n(p.stack)} 筹码${s.turnId===p.id?'，正在行动':''}"><div class="th-seat-cards">${(p.id===me.id?s.hand:p.cards).map(c=>card(c,{highlight:!!c&&p.id===me.id&&isBest(c)})).join('')}</div><div class="th-seat-body">${playerAvatar(room,p.id,'th-avatar')}<div class="th-seat-name">${playerName(room,p.id)}<strong>${n(p.stack)} <small>筹码</small></strong></div><div class="th-markers">${p.id===s.dealerId?'<span class="th-dealer" title="庄家按钮">D</span>':''}${p.id===s.smallId?'<span title="小盲注">SB</span>':''}${p.id===s.bigId?'<span title="大盲注">BB</span>':''}</div></div><div class="th-seat-status">${p.id===me.id?'你 · ':''}${p.out?'已淘汰':p.folded?'已弃牌':s.turnId===p.id?'正在行动':p.allIn?'全押':actionNames[p.lastAction]??'等待'}${p.bet&&!ended?`<span>${chips()}${n(p.bet)}</span>`:''}</div></article>`).join('');
  const preview=confirm?`<div class="th-confirm" role="group" aria-label="确认行动"><span>${confirm.type==='fold'?'可以免费过牌，仍要弃牌？':`确认${confirm.amount===l.maxRaiseTo?'全押':'加注到'} ${n(confirm.amount)}？本次投入 ${n(confirm.amount-self.bet)}，余下 ${n(self.stack-(confirm.amount-self.bet))}。`}</span>${b('取消','cancel',disabled)}${b(confirm.type==='fold'?'确认弃牌':'确认下注','confirm',disabled,'class="th-primary"')}</div>`:'';
  const control=mine&&!ended?`<div class="th-action-buttons">${b('弃牌','fold',disabled,'class="th-fold"')}${l.check?b('过牌','check',disabled,'class="th-check"'):b(`跟注 ${n(l.callAmount)}${l.callAmount===self.stack?' · 全押':''}`,'call',disabled,'class="th-check"')}${l.raise?b(`${s.currentBet?'加注到':'下注'} ${n(amount??l.minRaiseTo)}`,'raise',disabled,'class="th-primary" data-raise-label'):''}</div>${l.raise?`<div class="th-bet-controls"><div class="th-presets">${[['最小',l.minRaiseTo],['½ 底池',Math.max(l.fullRaiseTo,s.currentBet+Math.floor((s.pot+l.callAmount)/2))],['底池',Math.max(l.fullRaiseTo,s.currentBet+s.pot+l.callAmount)],['全押',l.maxRaiseTo]].map(([label,value])=>b(label,'preset',disabled,`data-amount="${Math.min(l.maxRaiseTo,value)}" aria-label="选择${label}下注金额"`)).join('')}</div><div class="th-bet-inputs"><label class="sr-only" for="th-range">调整本轮下注总额</label><input id="th-range" type="range" min="${l.minRaiseTo}" max="${l.maxRaiseTo}" step="1" value="${amount??l.minRaiseTo}" ${disabled?'disabled':''}><label for="th-amount">本轮总额</label><input id="th-amount" type="number" inputmode="numeric" min="${l.minRaiseTo}" max="${l.maxRaiseTo}" step="1" value="${amount??l.minRaiseTo}" ${disabled?'disabled':''}></div><small>最少 ${n(l.minRaiseTo)} · 最多 ${n(l.maxRaiseTo)}${l.maxRaiseTo<l.fullRaiseTo?' · 仅可不足额全押':''} · 金额包含本轮已投入的 ${n(self.bet)}</small></div>`:`<small>当前仅能过牌、跟注或弃牌${l.raiseReopened===false?' · 加注尚未重新开放':''}</small>`}${preview}`:ended?`<div class="th-between">${s.phase==='roundEnd'?(room.hostId===me.id?b('开始下一手 →','nextRound',disabled,'class="th-primary"'):`<span>等待房主 ${e(name(room.hostId))} 开始下一手</span>`):resultActions(room,me)}</div>`:'<div class="th-waiting"><span class="th-wait-dot"></span>请留意亮起的座位 · 你的底牌仅自己可见</div>';
  let panelBody='';
  if(panel==='guide')panelBody=guide();
  if(panel==='log')panelBody=`<h2>牌局记录</h2><p>第 ${s.handNumber} 手 · 仅显示公开行动</p><ol class="th-log">${s.log.slice().reverse().map(x=>`<li><small>#${x.hand} · ${streetNames[x.street]}</small><span>${x.id?e(name(x.id))+' · ':''}${actionNames[x.type]??e(x.type)}${x.amount!==null?' '+n(x.amount):''}</span></li>`).join('')}</ol>`;
  const results=ended?`<section class="th-settlement" aria-label="本手结算"><div><small>${result.showdown?'SHOWDOWN':'EVERYONE ELSE FOLDED'}</small><h2>${s.phase==='finished'?'本场结束':'本手结算'}</h2><p>${result.showdown?'以最佳五张牌比较 · 各底池分别结算':'其余玩家弃牌，获胜底牌保持私密'}${result.returned?` · ${e(name(result.returned.id))} 收回 ${n(result.returned.amount)}`:''}</p></div><div class="th-pot-results">${result.pots.map((p,i)=>`<article><span>${i?'边池 '+i:'主池'} <b>${n(p.amount)}</b></span><strong>${p.payouts.map(a=>`${e(name(a.id))} +${n(a.amount)}`).join(' / ')}</strong></article>`).join('')}</div><div class="th-standings"><table><thead><tr><th>玩家</th><th>摊牌牌型</th><th>本手净变化</th><th>现有筹码</th></tr></thead><tbody>${[...result.players].sort((a,b)=>b.stack-a.stack).map(p=>`<tr class="${p.won>0?'th-won':''}"><td>${e(name(p.id))}${p.id===me.id?' · 你':''}</td><td>${p.best?e(p.best.name):'未摊牌'}</td><td>${p.net>0?'+':''}${n(p.net)}</td><td>${n(p.stack)}</td></tr>`).join('')}</tbody></table></div>${s.phase==='finished'?'<p>按最终筹码排名；筹码相同可并列。桌内筹码不计入星辉余额。</p>':''}</section>`:'';
  return `<section class="th-game" aria-label="德州扑克牌桌" aria-busy="${busy}"><header class="th-header"><div><span class="th-eyebrow">MOON TABLE / NO LIMIT</span><span class="th-compact-round">第 ${s.handNumber} / ${s.options.handLimit} 手</span></div><div class="th-header-actions"><span class="th-blinds">盲注 <b>${n(s.smallBlind)} / ${n(s.bigBlind)}</b><small>每 5 手翻倍</small></span>${b('记录','log',false,'aria-label="打开牌局记录"')}${b('?','guide',false,'aria-label="打开德州扑克玩法"')}</div></header><div class="th-table th-count-${order.length}"><div class="th-rail" aria-hidden="true"><span>MOON TABLE</span></div><div class="th-board"><span class="th-street">${ended?'本手已结束':streetNames[s.street]}</span><div class="th-pot">${chips()}<span>${ended?'本手底池':'总底池'}<strong>${n(ended?result.pots.reduce((v,p)=>v+p.amount,0):s.pot)}</strong></span></div><div class="th-community" aria-label="公共牌">${Array.from({length:5},(_,i)=>card(s.board[i],{empty:!s.board[i],highlight:!!s.board[i]&&isBest(s.board[i])})).join('')}</div><div class="th-pot-caption">${s.players.some(p=>p.allIn)?'全押玩家按投入上限参与底池':'TEXAS HOLD’EM · 最佳五张'}</div></div>${seats}</div><div class="th-decision"><p class="th-prompt ${mine?'th-your-turn':''}" role="status" aria-live="polite">${e(prompt)}</p>${control}${error?`<p class="th-error" role="alert">${e(error)}</p>`:''}</div>${results}${panel?`<dialog class="th-dialog" open aria-label="${panel==='guide'?'德州扑克玩法':'牌局记录'}"><div class="th-dialog-top"><b>${panel==='guide'?'玩法手卡':'本桌记录'}</b>${b('×','closePanel',false,'aria-label="关闭面板"')}</div>${panelBody}</dialog>`:''}</section>`;
 }
 function input(event){
  if(!['th-range','th-amount'].includes(event.target.id)||!room?.game.legal.raise)return;
  amount=Number(event.target.value);confirm=null;
  const other=container.querySelector(event.target.id==='th-range'?'#th-amount':'#th-range');if(other)other.value=String(amount);
  const label=container.querySelector('[data-raise-label]');if(label)label.textContent=`${room.game.currentBet?'加注到':'下注'} ${n(amount)}`;
  container.querySelector('.th-confirm')?.remove();
 }
 function keyboard(event){if(event.key==='Escape'){if(panel){panel='';rerender();container.querySelector('[data-action="game:guide"]')?.focus();}else if(confirm){confirm=null;rerender();}}}
 function update(el,snapshot,me){
  if(container!==el){container?.removeEventListener('input',input);container?.removeEventListener('keydown',keyboard);container=el;el.addEventListener('input',input);el.addEventListener('keydown',keyboard);}
  const active=el.contains(document.activeElement)?document.activeElement:null,focusId=active?.id,focusAction=active?.dataset.action,focusAmount=active?.dataset.amount,scroll=el.querySelector('.th-dialog')?.scrollTop??0;
  const oldHand=room?.game?.handNumber,oldBoard=room?.game?.board.length??0;
  el.innerHTML=render(snapshot,me);
  if(oldHand===snapshot.game.handNumber&&snapshot.game.board.length>oldBoard&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   [...el.querySelectorAll('.th-community .th-card')].slice(oldBoard,snapshot.game.board.length).forEach((card,i)=>card.animate([{opacity:0,transform:'translateY(-12px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,delay:i*70,easing:'ease-out'}));
  }
  const dialog=el.querySelector('.th-dialog');if(dialog){dialog.removeAttribute('open');dialog.showModal();dialog.scrollTop=scroll;dialog.addEventListener('cancel',ev=>{ev.preventDefault();panel='';rerender();el.querySelector('[data-action="game:guide"]')?.focus();});}
  if(focusPanel){dialog?.querySelector('button')?.focus();focusPanel=false;}
  else if(focusId&&['th-range','th-amount'].includes(focusId))el.querySelector('#'+focusId)?.focus({preventScroll:true});
  else if(focusAction)el.querySelector(`[data-action="${focusAction}"]${focusAmount?`[data-amount="${focusAmount}"]`:""}:not(:disabled)`)?.focus({preventScroll:true});
 }
 return {render,update,async handle(action,target){
  if(['guide','log'].includes(action)){panel=action;focusPanel=true;rerender();return;}
  if(action==='closePanel'){panel='';rerender();container?.querySelector('[data-action="game:guide"]')?.focus();return;}
  if(action==='cancel'){confirm=null;rerender();return;}
  if(busy||room.dissolution)return;
  const s=room.game,l=s.legal;
  if(action==='preset'){amount=Number(target.dataset.amount);confirm=null;rerender();return;}
  if(action==='raise'){
    if(!Number.isSafeInteger(amount)||amount<l.minRaiseTo||amount>l.maxRaiseTo){error=`请输入 ${n(l.minRaiseTo)}–${n(l.maxRaiseTo)} 之间的整数`;rerender();return;}
    confirm={type:'raise',amount};rerender();container?.querySelector('[data-action="game:confirm"]')?.focus();return;
  }
  if(action==='fold'&&l.check){confirm={type:'fold'};rerender();return;}
  let command=action==='confirm'?confirm:['fold','check','call','nextRound'].includes(action)?{type:action}:null;if(!command)return;
  busy=true;error='';rerender();
  try{await send(command);confirm=null;}catch(err){error=err.message;}finally{busy=false;rerender();}
 },dispose(){container?.removeEventListener('input',input);container?.removeEventListener('keydown',keyboard);container=null;room=null;panel='';}};
}
