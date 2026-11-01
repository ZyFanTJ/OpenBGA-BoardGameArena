import {cardArt} from './art.js';

// Return events contain only cards that were already public, in their new orientation.
export function returnPlan(before,after){
 if(!before||before.round!==after.round||before.sequence+1!==after.sequence)return [];
 return (after.events??[]).filter(e=>e.type==='return'||e.type==='take'||e.type==='discard').map(event=>({
  playerId:event.playerId,kind:event.type,cards:event.cards.map(card=>{
   const owner=before.players.find(p=>p.areas.some(a=>a.some(c=>c.id===card.id)));
   const old=owner?.areas.flat().find(c=>c.id===card.id);
   return old?{before:old,after:card,from:owner.id}:null;
  }).filter(Boolean),
 })).filter(e=>e.cards.length);
}
export function createDnupMotion(paint){
 let root,shown,latest,revision=-1,queue=[],running=false,disposed=false,generation=0;
 const animations=new Set(),nodes=new Set(),sources=new Set(),reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 function clean(){for(const a of animations)a.cancel();animations.clear();for(const n of nodes)n.remove();nodes.clear();for(const n of sources)n.classList.remove('dn-return-source','dn-return-hidden');sources.clear();if(root){root.inert=false;root.removeAttribute('aria-busy');}}
 function cancel(){generation++;clean();running=false;queue=[];if(latest&&!disposed){paint(...latest);shown=latest[1];}}
 async function tween(node,frames,duration){const a=node.animate(frames,{duration,fill:'forwards',easing:'cubic-bezier(.22,.7,.2,1)'});animations.add(a);await a.finished.catch(()=>{});animations.delete(a);a.cancel();}
 const hold=(node,duration)=>tween(node,[{opacity:1},{opacity:1}],duration);
 async function play(plan,snapshot,token){
  const attack=snapshot.game.events.find(e=>e.type==='play'||e.type==='add');
  const label=document.createElement('div');label.className='dn-motion-label';label.setAttribute('role','status');
  label.textContent=attack&&plan.some(p=>p.kind==='return')?`${attack.cards[0].value} 压制 · 回手并旋转`:plan.every(p=>p.kind==='discard')?'出牌区清理 · 弃牌':'收回并旋转';root.append(label);nodes.add(label);
  if(attack){const actor=[...root.querySelectorAll('[data-player-id]')].find(n=>n.dataset.playerId===(attack.to??attack.playerId));const anchor=actor?.querySelector('.dn-set')?.getBoundingClientRect();if(anchor){const face=document.createElement('div');face.className='dn-card dn-return-ghost dn-attack-ghost';face.setAttribute('aria-hidden','true');face.innerHTML=cardArt(attack.cards[0]);Object.assign(face.style,{left:`${anchor.x+Math.max(0,(anchor.width-60)/2)}px`,top:`${anchor.y}px`,width:'60px',height:'88px'});document.body.append(face);nodes.add(face);}}
  const cards=plan.flatMap(event=>event.cards.map(c=>{
   const source=[...root.querySelectorAll('[data-dn-public]')].find(n=>n.dataset.dnPublic===String(c.before.id));
   const seat=[...root.querySelectorAll('[data-player-id]')].find(n=>n.dataset.playerId===event.playerId);
   const own=snapshot.game.players.find(p=>p.id===event.playerId)?.hand!==null;
   const destination=event.kind==='discard'?root.querySelector('.dn-table-info>span:first-child'):own?root.querySelector('.dn-hand'):seat?.querySelector('.dn-card-count');
   if(source){source.classList.add('dn-return-source');sources.add(source);}
   return {...c,kind:event.kind,source,destination};
  }));
  await hold(label,reduced.matches?1300:650);if(token!==generation)return;
  if(reduced.matches)return;
  await Promise.all(cards.map(async(c,i)=>{
   if(!c.source||!c.destination)return;
   const from=c.source.getBoundingClientRect(),to=c.destination.getBoundingClientRect();
   const ghost=document.createElement('div');ghost.className='dn-card dn-return-ghost';ghost.setAttribute('aria-hidden','true');ghost.innerHTML=cardArt(c.before);
   Object.assign(ghost.style,{left:`${from.x}px`,top:`${from.y}px`,width:`${Math.max(60,from.width)}px`,height:`${Math.max(88,from.height)}px`});document.body.append(ghost);nodes.add(ghost);c.source.classList.add('dn-return-hidden');
   if(c.kind!=='discard')await tween(ghost,[{transform:'translateY(0) rotate(0deg)'},{transform:'translateY(-18px) rotate(180deg)'}],460);
   if(token!==generation)return;
   ghost.innerHTML=cardArt(c.after);ghost.classList.add('dn-return-flipped');
   await hold(ghost,420);if(token!==generation)return;
   const x=to.x+to.width/2-from.x-30,y=to.y-from.y;
   await tween(ghost,[{transform:'translateY(0) scale(1)',opacity:1},{offset:.55,transform:`translate(${x*.55}px,${y*.55-35}px) scale(.85)`,opacity:1},{transform:`translate(${x}px,${y}px) scale(.25)`,opacity:0}],650+Math.min(i,4)*60);
   ghost.remove();nodes.delete(ghost);
  }));
 }
 async function drain(){if(running||disposed)return;running=true;const token=generation;
  try{while(queue.length&&token===generation&&!disposed){const item=queue.shift(),snapshot=item[1];root.inert=true;root.setAttribute('aria-busy','true');
   const continuous=shown?.matchId===snapshot.matchId;
   const plan=continuous&&!document.hidden?returnPlan(shown.game,snapshot.game):[];
   if(plan.length)await play(plan,snapshot,token);
   if(token!==generation||disposed)return;
   clean();paint(...item);shown=snapshot;
   if(plan.length&&!document.hidden){root.inert=true;root.setAttribute('aria-busy','true');
    const arriving=plan.flatMap(p=>{const me=snapshot.game.players.find(q=>q.id===p.playerId);if(p.kind==='discard')return [root.querySelector('.dn-table-info>span:first-child')];if(me?.hand!==null)return p.cards.map(c=>[...root.querySelectorAll('.dn-hand [data-card]')].find(n=>n.dataset.card===String(c.after.id)));return [[...root.querySelectorAll('[data-player-id]')].find(n=>n.dataset.playerId===p.playerId)?.querySelector('.dn-card-count')];}).filter(Boolean);
    await Promise.all(arriving.map(n=>tween(n,reduced.matches?[{outline:'2px solid #d4ee93'},{outline:'2px solid #d4ee93'}]:[{translate:'0 -12px',filter:'brightness(1.4)',outline:'2px solid #d4ee93'},{offset:.7,translate:'0 0',filter:'brightness(1.15)',outline:'2px solid #d4ee93'},{translate:'0 0',filter:'brightness(1)',outline:'0px solid transparent'}],650)));
   }
  }}catch(error){if(token===generation&&!disposed){queue=[];if(latest){paint(...latest);shown=latest[1];}console.error('DNUP animation failed',error);}}
  finally{if(token===generation){clean();running=false;}}
 }
 window.addEventListener('resize',cancel);window.addEventListener('scroll',cancel,true);document.addEventListener('visibilitychange',cancel);reduced.addEventListener('change',cancel);
 return {get busy(){return running;},update(el,snapshot,user,options={}){
  if(disposed||snapshot.revision<revision)return;root=el;latest=[el,snapshot,user];
  if(options.resetAnimations||!shown||shown.matchId!==snapshot.matchId||snapshot.dissolution){cancel();revision=snapshot.revision;return;}
  if(snapshot.revision===revision){if(!running)paint(el,snapshot,user);return;}
  revision=snapshot.revision;queue.push(latest);void drain();
 },dispose(){disposed=true;cancel();window.removeEventListener('resize',cancel);window.removeEventListener('scroll',cancel,true);document.removeEventListener('visibilitychange',cancel);reduced.removeEventListener('change',cancel);}};
}
