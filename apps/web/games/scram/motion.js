import {cardArt} from './art.js';

export function motionPlan(m){
 if(!m)return null;
 if(m.type==='replace'&&m.success)return {kind:'remove',targets:m.targets,label:'配对移除'};
 if(m.type==='ability'&&[9,10].includes(m.ability))return {kind:'remove',targets:m.targets,label:`${m.ability} · 移除卡牌`};
 if((m.type==='ability'&&m.ability===11)||(m.type==='resolve'&&m.swap))return {kind:'swap',targets:m.targets,label:'交换卡牌'};
 return null;
}
const refKey=r=>JSON.stringify([r.playerId,r.slot]);
/** Animate the old board before committing the next projection: positional slots
 * must not collapse until the viewer has seen exactly which cards moved. */
export function createScramMotion(paint){
 let root,shown,latestItem,accepted=-1,queue=[],running=false,disposed=false,generation=0,animations=new Set(),ghosts=new Set(),marked=new Set();
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 function cleanup(){for(const a of animations)a.cancel();animations.clear();for(const n of ghosts)n.remove();ghosts.clear();for(const n of marked)n.classList.remove('sc-motion-source','sc-motion-vacated');marked.clear();root?.classList.remove('sc-motion-playing');if(root){root.inert=false;root.removeAttribute('aria-busy');}}
 function cancel(){generation++;cleanup();running=false;const latest=latestItem;queue=[];if(latest&&!disposed){paint(...latest);shown=latest[1];}}
 const anchor=r=>[...root.querySelectorAll('[data-sc-ref]')].find(n=>n.dataset.scRef===refKey(r))??(r.playerId===null?root.querySelector('[data-action="game:deck"]'):null);
 async function animate(node,frames,ms){const a=node.animate(frames,{duration:ms,fill:'both',easing:'cubic-bezier(.22,.7,.2,1)'});animations.add(a);await a.finished.catch(()=>{});animations.delete(a);a.cancel();}
 async function play(plan,snapshot,token){
  const actor=snapshot.players.find(p=>p.id===snapshot.game.motion.actorId)?.name??'玩家';
  const label=document.createElement('div');label.className='sc-motion-label';label.setAttribute('role','status');label.textContent=`${actor} · ${plan.label}`;root.append(label);ghosts.add(label);
  const sources=plan.targets.map(anchor),rects=sources.map(n=>n?.getBoundingClientRect());
  const discard=root.querySelector('[data-action="game:discardPile"]')?.getBoundingClientRect();
  for(const n of sources)if(n){n.classList.add('sc-motion-source');marked.add(n);}
  await animate(label,[{opacity:1},{opacity:1}],reduced.matches?850:480);
  if(token!==generation)return;
  if(!reduced.matches)await Promise.all(sources.map(async(node,i)=>{
   node?.classList.add('sc-motion-vacated');const from=rects[i],to=plan.kind==='swap'?rects[1-i]:discard;if(!node||!from||!to)return;
   const ghost=document.createElement('div');ghost.className='sc-card sc-motion-ghost';ghost.setAttribute('aria-hidden','true');
   // Only removals have publicly revealed values. Never expose a peek in a swap.
   ghost.innerHTML=plan.kind==='remove'?cardArt(plan.targets[i].value):node.innerHTML;
   Object.assign(ghost.style,{left:`${from.x}px`,top:`${from.y}px`,width:`${from.width}px`,height:`${from.height}px`});document.body.append(ghost);ghosts.add(ghost);
   const x=to.x-from.x,y=to.y-from.y,bend=plan.kind==='swap'?(i===0?-65:65):-50;
   await animate(ghost,[{transform:'translate(0,0) scale(1.08)',opacity:1},{offset:.5,transform:`translate(${x*.5}px,${y*.5+bend}px) scale(1.18)`,opacity:1},{transform:`translate(${x}px,${y}px) scale(${plan.kind==='remove'?.8:1})`,opacity:plan.kind==='remove'?.25:1}],820+i*100);
   ghost.remove();ghosts.delete(ghost);
  }));
 }
 async function drain(){if(running||disposed)return;running=true;const token=generation;root.inert=true;root.setAttribute('aria-busy','true');root.classList.add('sc-motion-playing');
  try{while(queue.length&&token===generation&&!disposed){const item=queue.shift(),snapshot=item[1];const contiguous=shown&&shown.matchId===snapshot.matchId&&shown.game.round===snapshot.game.round&&shown.game.sequence+1===snapshot.game.sequence;
    const plan=contiguous&&!document.hidden&&queue.length<6?motionPlan(snapshot.game.motion):null;
    if(plan)await play(plan,snapshot,token);
    if(token!==generation||disposed)return;
    cleanup();paint(...item);shown=snapshot;
    if(queue.length){root.inert=true;root.setAttribute('aria-busy','true');}
  }}catch(error){if(token===generation&&!disposed){queue=[];if(latestItem){paint(...latestItem);shown=latestItem[1];}console.error('SCRAM animation failed',error);}}finally{if(token===generation){cleanup();running=false;}}
 }
 window.addEventListener('resize',cancel);window.addEventListener('scroll',cancel,true);document.addEventListener('visibilitychange',cancel);reduced.addEventListener('change',cancel);
 return {get busy(){return running;},update(el,snapshot,user,options={}){
   root=el;if(disposed||snapshot.revision<accepted)return;latestItem=[el,snapshot,user];
   if(options.resetAnimations||!shown||shown.matchId!==snapshot.matchId||snapshot.dissolution){cancel();accepted=snapshot.revision;paint(el,snapshot,user);shown=snapshot;return;}
   if(snapshot.revision===accepted){if(!running)paint(el,snapshot,user);return;}
   accepted=snapshot.revision;queue.push([el,snapshot,user]);void drain();
  },dispose(){disposed=true;cancel();window.removeEventListener('resize',cancel);window.removeEventListener('scroll',cancel,true);document.removeEventListener('visibilitychange',cancel);reduced.removeEventListener('change',cancel);}};
}
