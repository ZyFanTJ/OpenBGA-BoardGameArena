// Fair local opponents. The only inputs are a player's projection and ephemeral memory.
const key=r=>JSON.stringify([r.playerId,r.slot]);
const ref=c=>({playerId:c.playerId,slot:c.slot});
const values=Array.from({length:14},(_,i)=>i===13?'=':i+1);
const ended=v=>['roundEnd','finished'].includes(v.phase);
function discardCards(discard,cards){discard.push(...[...cards].sort((a,b)=>(b==='='?99:b)-(a==='='?99:a)));}

export function observe(v,id,previous={}) {
  const reset=previous.round!==v.round || !previous.known;
  const fresh=reset || (v.sequence!==previous.sequence && (v.sequence!==previous.sequence+1 || v.motion?.sequence!==v.sequence));
  const known=fresh?Object.fromEntries(v.players.map(p=>[p.id,p.cards.map(()=>null)])):structuredClone(previous.known);
  let deck=fresh?[null,null]:[...(previous.deck??[null,null])];
  const discard=fresh?(v.discardTop===null?[]:[v.discardTop]):[...(previous.discard??[])];
  let held=fresh?null:previous.held??null;
  const get=r=>r.playerId===null?deck[r.slot]??null:known[r.playerId]?.[r.slot]??null;
  const set=(r,value)=>{if(r.playerId===null)deck[r.slot]=value;else known[r.playerId][r.slot]=value;};
  const remove=refs=>{
    for(const owner of new Set(refs.map(r=>r.playerId))){
      const slots=refs.filter(r=>r.playerId===owner).map(r=>r.slot).sort((a,b)=>b-a);
      const list=owner===null?deck:known[owner];for(const slot of slots)list.splice(slot,1);
    }
    while(deck.length<2)deck.push(null);
  };
  const add=(owner,value,side)=>side==='left'?known[owner].unshift(value):known[owner].push(value);
  if(!fresh && v.sequence!==previous.sequence){
    const m=v.motion;
    if(m.type==='draw'){
      held=m.source==='discard'?discard.pop()??previous.discardTop:get({playerId:null,slot:0});
      if(m.source==='deck')deck=[deck[1]??null,null];
    }
    if(m.type==='discard'){discard.push(m.value);held=null;}
    if(m.type==='replace'){
      const incoming=m.incoming??held;
      if(m.success){
        const insert=m.insertSlot-m.targets.filter(r=>r.playerId===m.actorId&&r.slot<m.insertSlot).length;
        remove(m.targets);known[m.actorId].splice(insert,0,incoming);discardCards(discard,m.targets.map(r=>r.value));
      }else{
        for(const r of m.targets)set(r,r.value);
        add(m.actorId,incoming,m.side);
        for(let i=0;i<m.penalty;i++){add(m.actorId,null,m.side);deck=[deck[1]??null,null];}
      }
      held=null;
    }
    if(m.type==='ability'){
      if(![9,13].includes(m.ability))discard.push(m.ability);
      if([9,10].includes(m.ability)){remove(m.targets);discardCards(discard,m.targets.map(r=>r.value));}
      if(m.ability===9)add(m.actorId,9,m.side);
      if(m.ability===13)add(m.playerId,13,m.side);
      if(m.ability===11){const [a,b]=m.targets,x=get(a),y=get(b);set(a,y);set(b,x);}
      held=null;
    }
    if(m.type==='resolve'&&m.swap){const [a,b]=m.targets,x=get(a),y=get(b);set(a,y);set(b,x);}
  }
  for(const p of v.players){
    if(known[p.id]?.length!==p.cards.length)known[p.id]=p.cards.map(()=>null);
    for(const c of p.cards)if(c.value!==null)known[p.id][c.slot]=c.value;
  }
  if(v.deckTop!==null)deck[0]=v.deckTop;
  for(const r of v.reveal?.reveals??[])set(r,r.value);
  if(v.drawn)held=v.drawn.value;
  if(v.phase==='turn'||ended(v))held=null;
  return {round:v.round,sequence:v.sequence,known,deck,discard,held,discardTop:v.discardTop};
}

export function unseenDistribution(v,memory={}) {
  const counts=Object.fromEntries(values.map(n=>[n,v.players.length===6?5:4]));
  const subtract=n=>{if(n!==null&&n!==undefined&&counts[n]>0)counts[n]--;};
  for(const p of v.players)for(const c of p.cards)subtract(c.value??memory.known?.[p.id]?.[c.slot]);
  for(const n of memory.discard??(v.discardTop===null?[]:[v.discardTop]))subtract(n);
  for(const n of (memory.deck??[]).slice(0,v.deckCount))subtract(n);
  subtract(v.drawn?.value??memory.held);
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  return values.map(value=>({value,count:counts[value],probability:total?counts[value]/total:1/14}));
}
function camp(cards){const ns=cards.filter(n=>n!=='=');const low=ns.length?Math.min(...ns):0;return cards.reduce((n,c)=>n+(c==='='?low:c),0);}
function seedRandom(v,id){let seed=2166136261;for(const c of `${id}:${v.round}:${v.sequence}`)seed=Math.imul(seed^c.charCodeAt(0),16777619);return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function model(v,id,memory,level){
  const team=v.players.find(p=>p.id===id).team,distribution=unseenDistribution(v,memory),random=seedRandom(v,id);
  const cards=v.players.flatMap(p=>p.cards.map(c=>({...ref({playerId:p.id,slot:c.slot}),team:p.team,value:c.value??memory.known?.[p.id]?.[c.slot]??null,faceUp:c.faceUp})));
  for(let i=0;i<Math.min(2,v.deckCount);i++)cards.push({playerId:null,slot:i,team:null,value:i===0?(v.deckTop??memory.deck?.[0]??null):(memory.deck?.[1]??null),faceUp:false});
  // Stratified deterministic samples prevent action jitter; unknown draws never use server state.
  const worlds=Array.from({length:level==='ruthless'?24:12},()=>{
    const pool=distribution.flatMap(d=>Array(d.count).fill(d.value));
    const sample=()=>pool.length?pool.splice(Math.floor(random()*pool.length),1)[0]:values[Math.floor(random()*14)];
    return {hands:v.players.map(p=>cards.filter(c=>c.playerId===p.id).map(c=>c.value??sample())),deck:cards.filter(c=>c.playerId===null).map(c=>c.value??sample())};
  });
  const ownIndex=v.players.findIndex(p=>p.id===id),indices=Object.fromEntries(v.players.map((p,i)=>[p.id,i]));
  const sums=w=>[0,1].map(t=>v.players.reduce((n,p,i)=>n+(p.team===t?camp(w.hands[i]):0),0));
  const utility=w=>{
    const raw=sums(w),points=[...raw],callerTeam=v.players.find(p=>p.id===v.caller)?.team;
    if(callerTeam!==undefined)points[callerTeam]=raw[callerTeam]<=raw[1-callerTeam]?0:raw[callerTeam]+10;
    let score=points[1-team]-points[team];
    if(!v.caller&&v.deckCount>2){
      score+=v.players.reduce((n,p,i)=>n+(p.team===team?-1:1)*w.hands[i].length*.65,0);
      // A low anchor reduces every '='; calculate this in camp(), not by treating '=' as zero.
    }
    if(v.round===v.rounds&&(v.caller||v.deckCount<5))score+=8*Math.sign(v.totals[1-team]+points[1-team]-v.totals[team]-points[team]);
    return score;
  };
  const get=(w,r)=>r.playerId===null?w.deck[r.slot]:w.hands[indices[r.playerId]][r.slot];
  const set=(w,r,n)=>{if(r.playerId===null)w.deck[r.slot]=n;else w.hands[indices[r.playerId]][r.slot]=n;};
  const exchange=(w,a,b)=>{const x=get(w,a);set(w,a,get(w,b));set(w,b,x);};
  const remove=(w,refs)=>{for(const owner of new Set(refs.map(r=>r.playerId)))for(const r of refs.filter(r=>r.playerId===owner).sort((a,b)=>b.slot-a.slot))(owner===null?w.deck:w.hands[indices[owner]]).splice(r.slot,1);};
  const information=(refs,publicReveal=false)=>v.caller||v.deckCount<3?0:refs.reduce((sum,r)=>{
    const c=cards.find(c=>key(c)===key(r));if(!c||c.value!==null)return sum;
    if(c.playerId===null){const next=v.players[(indices[id]+1)%v.players.length];return sum+(next.team===team?.6:.08);}
    const own=c.playerId===id;return sum+(c.team===team?(own?1.1:publicReveal?1.05:.75):publicReveal?-.3:.5)*(level==='ruthless'?1.15:1);
  },0);
  const evaluate=(command,value)=>{
    let total=0;
    for(const base of worlds){
      const w={hands:base.hands.map(h=>[...h]),deck:[...base.deck]},refs=command.targets??[];
      if(command.type==='replace'){
        const unique=new Set(refs.map(r=>get(w,r)).filter(n=>n!=='='));
        if(unique.size<=1){const slot=refs[0].slot;remove(w,refs);w.hands[ownIndex].splice(slot-refs.filter(r=>r.playerId===id&&r.slot<slot).length,0,value);}
        else w.hands[ownIndex].push(value,...Array(Math.min(3,Math.max(0,unique.size-2))).fill(7));
      }
      if(command.type==='ability'){
        if(value===13)w.hands[indices[command.playerId]].push(13);
        if([9,10].includes(value)){remove(w,refs);if(value===9)w.hands[ownIndex].push(9);}
        if(value===11)exchange(w,...refs);
        if(value===12){const before=utility(w);exchange(w,...refs);total+=Math.max(before,utility(w));continue;}
      }
      if(command.type==='resolve'&&command.swap)exchange(w,...v.reveal.targets);
      total+=utility(w);
    }
    let score=total/worlds.length;
    if(command.type==='ability'&&[5,6,7,8,12].includes(value))score+=information(command.targets,[7,8].includes(value));
    return score;
  };
  return {team,players:v.players,cards,worlds,sums,utility,evaluate,information,distribution};
}
function replacementCandidates(m,id){
  const friends=m.cards.filter(c=>c.team===m.team),own=friends.filter(c=>c.playerId===id),commands=[];
  const seen=new Set();
  const add=cs=>{if(!cs.length||!cs.some(c=>c.playerId===id))return;cs=[cs.find(c=>c.playerId===id),...cs.filter(c=>c!==cs.find(c=>c.playerId===id))];const k=cs.map(key).sort().join('|');if(!seen.has(k)){seen.add(k);commands.push({type:'replace',targets:cs.map(ref)});}};
  for(const c of own)add([c]);
  for(const n of values)add(friends.filter(c=>c.value===n||c.value==='='));
  // A single unknown plus '=' is certain to match, and can remove a teammate's mystery card.
  for(const c of friends.filter(c=>c.value===null))add([c,...friends.filter(c=>c.value==='=')]);
  return commands;
}
function candidates(m,id,value,source,level){
  const cmds=replacementCandidates(m,id);
  if(source==='discard')return cmds;
  cmds.push({type:'discard'});
  if(!Number.isInteger(value)||value<5)return cmds;
  const camps=m.cards.filter(c=>c.playerId!==null),friends=camps.filter(c=>c.team===m.team);
  if(value===13){for(const p of m.players.filter(p=>p.team!==m.team))cmds.push({type:'ability',playerId:p.id});return cmds;}
  if([5,7,10].includes(value))for(const c of m.cards.filter(c=>c.playerId!==null||c.slot===0))cmds.push({type:'ability',targets:[ref(c)]});
  if([6,8,9,11,12].includes(value)){
    // Enumerate positional pairs; the physical 70-card supply bounds this search.
    let pool=m.cards;
    if(value===9)pool=[...friends,...m.cards.filter(c=>c.playerId===null)];
    for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){
      const a=pool[i],b=pool[j];
      if([a,b].some(c=>c.playerId===null&&c.slot===1)&&(![a,b].some(c=>c.playerId===null&&c.slot===0)||value===11))continue;
      cmds.push({type:'ability',targets:[ref(a),ref(b)]});
    }
  }
  return cmds;
}
function best(m,id,value,source,level){
  let winner=null,score=-Infinity;
  for(const cmd of candidates(m,id,value,source,level)){
    const s=m.evaluate(cmd,value);
    if(s>score+1e-8){score=s;winner=cmd;}
  }
  return {command:winner,score};
}
function callWorthwhile(v,id,m,level){
  if(!v.legal.scram)return false;
  let success=0,reward=0;
  for(const w of m.worlds){
    const score=m.sums(w),ours=score[m.team],opponent=score[1-m.team];
    // The next rival can take the visible discard immediately. Do not price this
    // certain opportunity as if it required a lucky blind draw.
    let reduction=0;
    const seat=v.players.findIndex(p=>p.id===id);
    const nextSeat=v.players.length===3?(seat===0?null:0):(seat+1)%v.players.length;
    if(level==='ruthless')for(let i=0;i<v.players.length;i++)if(v.players[i].team!==m.team){
      const hand=w.hands[i],high=Math.max(0,...hand.map(n=>n==='='?0:n));
      const canTake=i===nextSeat||(v.players.length===3&&seat===0&&nextSeat===null);
      const discardGain=v.discardTop==='='?high:typeof v.discardTop==='number'?Math.max(0,high-v.discardTop):0;
      let gain=Math.max(Math.max(0,high-4)*.32,canTake?discardGain*.9:0);
      if(v.players.length===3&&seat!==0&&i===0)gain+=Math.max(0,high-4)*.22;
      reduction+=gain;
    }
    const win=ours<=Math.max(0,opponent-reduction);success+=Number(win);reward+=win?ours:-10;
  }
  const chance=success/m.worlds.length,threshold=level==='ruthless'?.88:level==='easy'?.7:.8;
  return chance>=threshold && reward/m.worlds.length>=0;
}
function easyDecision(v,id,memory){
  if(v.phase==='reveal')return {type:'resolve',swap:false};
  const own=v.players.find(p=>p.id===id),known=memory.known[id];
  if(v.phase==='turn'){
    const expected=p=>memory.known[p.id].reduce((sum,n)=>sum+(n==='='?2:n??7),0);
    const ours=v.players.filter(p=>p.team===own.team).reduce((n,p)=>n+expected(p),0);
    const theirs=v.players.filter(p=>p.team!==own.team).reduce((n,p)=>n+expected(p),0);
    return v.legal.scram&&ours+3<theirs?{type:'scram'}:{type:'draw',source:'deck'};
  }
  if(v.phase!=='drawn')return null;
  const value=v.drawn.value;
  if(value===13&&v.drawn.source==='deck')return {type:'ability',playerId:v.players.find(p=>p.team!==own.team).id};
  if(!own.cards.length)return {type:'discard'};
  const rank=n=>n==='='?2:n??7;
  const worst=own.cards.reduce((a,c)=>rank(known[c.slot])>rank(known[a.slot])?c:a,own.cards[0]);
  if(value===10&&v.drawn.source==='deck')return {type:'ability',targets:[{playerId:id,slot:worst.slot}]};
  if(v.drawn.source==='discard'||rank(value)<rank(known[worst.slot]))return {type:'replace',targets:[{playerId:id,slot:worst.slot}]};
  return {type:'discard'};
}
export function decide(v,id,memory={}, {difficulty='smart'}={}){
  if(!v.legal.act||ended(v))return null;
  const level=['easy','smart','ruthless'].includes(difficulty)?difficulty:'smart';
  // Reconcile fresh private reveal data even for stateless timeout callers.
  const observed=observe(v,id,memory);
  if(level==='easy')return easyDecision(v,id,observed);
  const m=model(v,id,observed,level);
  if(v.phase==='reveal'){
    if(v.reveal.value!==12)return {type:'resolve',swap:false};
    const stay={type:'resolve',swap:false},swap={type:'resolve',swap:true};
    return m.evaluate(swap)>m.evaluate(stay)+.05?swap:stay;
  }
  if(v.phase==='drawn')return best(m,id,v.drawn.value,v.drawn.source,level).command;
  if(v.phase==='turn'){
    if(callWorthwhile(v,id,m,level))return {type:'scram'};
    if(v.legal.discardDraw){
      const take=best(m,id,v.discardTop,'discard',level);
      const base=m.worlds.reduce((sum,w)=>sum+m.utility(w),0)/m.worlds.length;
      // Price a blind draw against cheap replacement options plus its ability option.
      const replacements=replacementCandidates(m,id);
      let drawGain=0;
      const knownTop=v.deckTop??observed.deck[0];
      for(const d of knownTop===null?m.distribution:[{value:knownTop,probability:1}]){
        let gain=0;for(const cmd of replacements)gain=Math.max(gain,m.evaluate(cmd,d.value)-base);
        const high=Math.max(0,...m.cards.filter(c=>c.team===m.team).map(c=>c.value==='='?2:c.value??7));
        const ability=d.value===13?9:d.value===10?high:d.value===9?Math.max(0,high*1.5-9):[11,12].includes(d.value)?Math.max(2,high-3):[5,6,7,8].includes(d.value)?1:0;
        drawGain+=d.probability*Math.max(gain,ability);
      }
      if(take.score>base+drawGain+(level==='easy'?.1:.5))return {type:'draw',source:'discard'};
    }
    return {type:'draw',source:'deck'};
  }
  return null;
}
export const scramBot={observe,decide,difficulties:[{id:'smart',label:'老练营员'},{id:'easy',label:'轻松露营'},{id:'ruthless',label:'森林高手'}]};
