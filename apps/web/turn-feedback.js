/** Shared room settings; time limits belong to the platform, outside game options. */
export const turnLimitField=(value=60,id='turn-seconds',supported=true)=>`<label for="${id}">单轮操作时限</label><select id="${id}" name="turnSeconds">${[[0,'不限时'],[30,'30 秒'],[60,'60 秒'],[120,'120 秒'],[300,'300 秒']].map(([seconds,label])=>`<option value="${seconds}" ${!supported&&seconds!==0?'disabled':''} ${seconds===value?'selected':''}>${label}</option>`).join('')}</select><p class="turn-limit-note" data-turn-limit-note ${value===0?'hidden':''}>超时自动完成本轮操作</p>`;

export function turnCountdownText(turn,elapsedMs=0){
 const remaining=turn.remainingMs===null?null:Math.max(0,turn.remainingMs-(turn.paused?0:elapsedMs));
 const seconds=remaining===null?null:Math.ceil(remaining/1000);
 return seconds===null?(turn.seconds?'—':'不限时'):seconds===0?'自动行动中':`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
export function createTurnFeedback(getRoom){
 let lastKey='',baseTitle=null;
 function sync(){
  const room=getRoom(),turn=room?.turn,cue=document.querySelector('#turn-cue');
  const playing=room?.status==='playing'&&!!turn&&turn.key!==null;
  const mine=playing&&turn.required&&!turn.paused;
  document.querySelector('.room-layout')?.classList.toggle('has-active-turn',!!playing&&!turn.paused);
  document.querySelector('.room-layout')?.classList.toggle('is-my-turn',!!mine);
  if(mine&&baseTitle===null){baseTitle=document.title;document.title='● 轮到你 · '+baseTitle;}
  if(!mine&&baseTitle!==null){document.title=baseTitle;baseTitle=null;}
  if(!cue)return;
  cue.hidden=!playing;if(!playing)return;
  const label=turn.paused?'投票中 · 已暂停':mine?'轮到你操作':'等待其他玩家';
  cue.classList.toggle('is-required',!!mine);
  if(cue.querySelector('.turn-cue-label').textContent!==label)cue.querySelector('.turn-cue-label').textContent=label;
  const nextKey=room.matchId+':'+turn.key+':'+mine;
  if(mine&&lastKey!==nextKey){cue.classList.remove('turn-arrival');void cue.offsetWidth;cue.classList.add('turn-arrival');}
  lastKey=nextKey;
  tick();
 }
 let sample=null,sampledAt=0;
 function sampleClock(){const turn=getRoom()?.turn;if(turn!==sample){sample=turn;sampledAt=performance.now();}}
 function tick(){
  sampleClock();
  const room=getRoom(),turn=room?.turn,cue=document.querySelector('#turn-cue');if(!cue||!turn||cue.hidden)return;
  const remaining=turn.remainingMs===null?null:Math.max(0,turn.remainingMs-(turn.paused?0:performance.now()-sampledAt));
  const seconds=remaining===null?null:Math.ceil(remaining/1000);
  const text=turnCountdownText(turn,performance.now()-sampledAt);
  const counter=cue.querySelector('.turn-countdown');if(counter.textContent!==text)counter.textContent=text;
  document.querySelectorAll('[data-turn-countdown]').forEach(el=>{if(el.textContent!==text)el.textContent=text;el.classList.toggle('is-urgent',turn.required&&!turn.paused&&seconds!==null&&seconds<=10);});
  cue.classList.toggle('is-urgent',turn.required&&!turn.paused&&seconds!==null&&seconds<=10);
  cue.style.setProperty('--turn-progress',remaining===null?0:Math.min(1,remaining/(turn.seconds*1000)));
 }
 const timer=setInterval(()=>{if(!getRoom()){if(baseTitle!==null){document.title=baseTitle;baseTitle=null;}return;}tick();},200);
 return {sync,dispose(){clearInterval(timer);if(baseTitle!==null)document.title=baseTitle;}};
}
export const turnCue=()=>'<div id="turn-cue" class="turn-cue" hidden><span class="turn-cue-dot" aria-hidden="true"></span><span class="turn-cue-label" role="status" aria-live="polite"></span><span class="turn-countdown" role="timer" aria-label="本轮剩余时间" aria-live="off"></span><span class="turn-cue-progress" aria-hidden="true"></span></div>';
