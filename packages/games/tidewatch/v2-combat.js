import {CARDS,ENEMIES,DIFFICULTIES,PADS,LENGTH,STEP,pointAt,traits,towerStats} from './v2-catalog.js';
import {player,emit} from './v2-state.js';
import {crossedBounty} from './v2-bounties.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const has=(p,id)=>p.relics.includes(id)||p.bountyRelic===id;
export function spawn(s,kind,sector,extra={}){
 const b=ENEMIES[kind],wave=extra.wave??s.wave,scale=Math.pow(1.17,wave-1)*DIFFICULTIES[s.difficulty].hp,hp=Math.round(b.hp*scale);
 const e={id:s.nextEnemyId++,kind,sector,origin:sector,d:0,hp,maxHp:hp,speed:b.speed,armor:b.armor,resist:b.resist,slow:1,slowUntil:0,wetUntil:0,burnUntil:0,burnDamage:0,burnOwner:null,burnPrimary:false,markUntil:0,markOwner:null,markHits:[],shredUntil:0,fuseOwner:null,crossings:0,summonAt:s.time+6000,...extra};s.enemies.push(e);return e;
}
function context(s){return {state:s,positions:new Map(s.enemies.map(e=>[e.id,pointAt(e.d)])),traits:Object.fromEntries(s.players.map(p=>[p.id,traits(s.towers,p.id)])),stats:new Map(s.towers.map(t=>[t.id,towerStats(t,player(s,t.owner))]))};}
function pos(c,e){return c.positions.get(e.id)??pointAt(e.d);}
export function hurt(s,e,amount,type,owner,primary=false){
 if(!e||e.hp<=0)return;const p=player(s,owner);let armor=type==='physical'?Math.max(0,e.armor-(e.shredUntil>s.time?.15:0)):type==='magic'?e.resist:0;
 if(e.kind==='crystal'&&s.enemies.some(x=>x.hp>0&&x.sourceBounty===e.bounty&&x.sector===e.sector&&Math.abs(x.d-e.d)<150))armor=1-(1-armor)*.7;
 const dealt=Math.max(.1,amount*(1-armor)*(primary&&e.markUntil>s.time?1.1:1));p.stats.damage+=Math.min(e.hp,dealt);e.hp-=dealt;
 if(e.hp<=0){p.stats.kills++;s.totalKills++;if(e.crossings>0)p.stats.rescues++;p.combo=s.time-p.lastKill<=1600?p.combo+1:1;p.lastKill=s.time;p.stats.peakCombo=Math.max(p.stats.peakCombo,p.combo);emit(s,{type:'kill',enemy:e.id,sector:e.sector,d:e.d,kind:e.kind,owner,combo:p.combo});}
}
const living=(s,sector)=>s.enemies.filter(e=>e.hp>0&&e.sector===sector);
function area(s,c,sector,d,radius,damage,type,owner,max=8,seen=null){const origin=pointAt(d),victims=living(s,sector).filter(e=>distance(pos(c,e),origin)<=radius).slice(0,max);for(const e of victims){hurt(s,e,damage*(seen?.has(e.id)?.5:1),type,owner);seen?.add(e.id);}return victims;}
function beam(s,sector,d,damage,owner,faction='star',length=340){const targets=living(s,sector).filter(e=>e.d>=d-20&&e.d<=d+length).slice(0,12);for(const e of targets)hurt(s,e,damage,faction==='gear'?'physical':'magic',owner);emit(s,{type:'beam',sector,d,endD:Math.min(LENGTH,d+length),faction,owner});return targets;}
function zone(s,value){if(s.zones.length>=32)s.zones.shift();s.zones.push({id:s.nextZoneId++,nextTick:s.time,...value});}
function statsFor(c,t){const st={...(c.stats.get(t.id)??towerStats(t,player(c.state,t.owner)))};if(t.temporary)st.damage*=t.damageFactor??.45;return st;}
function strongest(s,c,owner,faction){const list=s.towers.filter(t=>t.owner===owner&&!t.temporary&&CARDS[t.kind].faction===faction);return list.sort((a,b)=>statsFor(c,b).damage-statsFor(c,a).damage)[0];}
function targetsFor(s,c,t,st){const pad=PADS[t.pad],guide=s.towers.some(x=>x.owner===t.owner&&CARDS[x.kind].guide&&distance(PADS[x.pad],pad)<=230),list=living(s,t.sector).filter(e=>distance(pos(c,e),pad)<=st.range+(guide?25:0));list.sort((a,b)=>t.target==='strong'||st.astral?b.hp-a.hp:t.target==='healer'?(Number(b.kind==='shaman')-Number(a.kind==='shaman')||b.d-a.d):b.d-a.d);return list;}
function chain(s,c,sector,first,count,reach=150){const hits=[first];while(hits.length<count){const from=hits.at(-1),next=living(s,sector).filter(e=>!hits.includes(e)&&distance(pos(c,from),pos(c,e))<=reach).sort((a,b)=>distance(pos(c,from),pos(c,a))-distance(pos(c,from),pos(c,b)))[0];if(!next)break;hits.push(next);}return hits;}
function markProc(s,c,e,t){
 if(e.hp<=0||e.markUntil<=s.time)return;const p=player(s,e.markOwner),f=c.traits[p.id];if(f.star<4)return;
 e.markHits=e.markHits.filter(x=>s.time-x.at<=4000&&x.id!==t.id);e.markHits.push({id:t.id,at:s.time});if(e.markHits.length<3||(e.markProcAt??0)>s.time)return;
 const keep=has(p,'echo')?e.markHits.at(-1):null;e.markHits=[];e.markProcAt=s.time+1000;const tower=strongest(s,c,p.id,'star'),damage=tower?statsFor(c,tower).damage*1.4:35;
 hurt(s,e,damage,'magic',p.id);p.procs.star++;emit(s,{type:'proc',faction:'star',owner:p.id,sector:e.sector,d:e.d});
 const next=living(s,e.sector).filter(x=>x.id!==e.id&&Math.abs(x.d-e.d)<=260).sort((a,b)=>b.hp-a.hp)[0];if(next){next.markUntil=e.markUntil;next.markOwner=p.id;next.markHits=keep?[keep]:[];}
 if(f.star>=6&&p.procs.star%3===0){beam(s,e.sector,e.d,damage*1.3,p.id);if(has(p,'doublestar'))s.echoes.push({at:s.time+1000,sector:e.sector,d:e.d,damage:damage*.65,owner:p.id,faction:'star'});}
}
function primaryHit(s,c,t,st,e,first){
 const p=player(s,t.owner),f=c.traits[p.id];
 if(st.wet)e.wetUntil=s.time+(f.tide>=2?4000:2000);
 if(st.burn){const bellows=s.towers.some(x=>x.owner===p.id&&CARDS[x.kind].bellows&&distance(PADS[x.pad],PADS[t.pad])<210),amount=st.damage*.2*(bellows?1.25:1);if(e.burnUntil<=s.time||amount>=e.burnDamage){e.burnDamage=amount;e.burnOwner=p.id;e.burnPrimary=true;}e.burnUntil=Math.max(e.burnUntil,s.time+(f.ember>=2?5000:3000));}
 if(st.fuse)e.fuseOwner=p.id;if(st.shred)e.shredUntil=s.time+4000;
 if(st.mark){if(e.markUntil<=s.time){e.markOwner=p.id;e.markHits=[];}e.markUntil=s.time+(f.star>=2?9000:6000);}
 if(has(p,'ferry')&&e.crossings>0&&(e.ferryAt??0)<=s.time){e.shredUntil=s.time+3000;e.ferryAt=s.time+6000;}
 hurt(s,e,st.damage,st.damageType,p.id,true);
 if(t.kind==='tide0'&&e.wetUntil>s.time)hurt(s,e,st.damage*.35,'physical',p.id);
 if(!t.temporary)markProc(s,c,e,t);
 if(first&&f.tide>=4&&e.wetUntil>s.time){p.procs.tide++;if(has(p,'conductor')&&(e.conductorAt??0)<=s.time){p.procs.tide++;e.conductorAt=s.time+3000;}
  if(p.procs.tide>=6&&p.nextTide<=s.time){p.procs.tide-=6;p.nextTide=s.time+1000;const hits=chain(s,c,t.sector,e,3);for(const q of hits)hurt(s,q,st.damage*.9,'magic',p.id);emit(s,{type:'proc',faction:'tide',owner:p.id,sector:t.sector,d:e.d,targets:hits.map(x=>({id:x.id,d:x.d}))});if(f.tide>=6)zone(s,{kind:'conduct',owner:p.id,sector:t.sector,d:e.d,until:s.time+2000,width:95});}
 }
}
function spawnTurret(s,t){const own=s.towers.filter(x=>x.owner===t.owner&&x.temporary);if(own.length>=4||own.filter(x=>x.parent===t.id).length>=2)return;s.towers.push({id:s.nextCardId++,kind:'gear0',star:1,owner:t.owner,sector:t.sector,pad:t.pad,temporary:true,parent:t.id,offsetX:own.length%2?28:-28,expires:s.time+12000,damageFactor:t.kind==='gear5'?.8:.55,nextShot:s.time+500,shots:0,target:'first'});}
function shoot(s,c,t){
 const p=player(s,t.owner),st=statsFor(c,t),f=c.traits[p.id],inRange=targetsFor(s,c,t,st);if(!inRange.length)return;
 const target=inRange[0];t.nextShot=s.time+st.cooldown;t.shots=(t.shots??0)+1;
 let hits=[target];if(st.splash)hits=inRange.filter(e=>distance(pos(c,e),pos(c,target))<=st.splash).slice(0,8);else if(st.chain){const extension=s.zones.some(z=>z.kind==='conduct'&&z.owner===p.id&&z.sector===t.sector&&Math.abs(z.d-target.d)<z.width)?1:0;hits=chain(s,c,t.sector,target,st.chain+extension);}
 if(st.fan&&t.shots%3===0)hits=inRange.slice(0,3);
 emit(s,{type:'shot',tower:t.id,pad:t.pad,sector:t.sector,kind:t.kind,temporary:!!t.temporary,targets:hits.map(e=>({id:e.id,d:e.d}))});
 if(t.temporary){for(const e of hits)hurt(s,e,st.damage,st.damageType,p.id);return;}
 for(let i=0;i<hits.length;i++)primaryHit(s,c,t,st,hits[i],i===0);
 if(f.gear>=2&&st.faction==='gear'&&t.shots%3===0)hurt(s,target,st.damage*.5,st.damageType,p.id);
 if(st.assembly&&t.shots%8===0)spawnTurret(s,t);
 if(st.astral&&t.shots%4===0){const list=chain(s,c,t.sector,target,st.constellation?5:2,210);for(const e of list)hurt(s,e,st.damage*.7,'magic',p.id);emit(s,{type:'proc',faction:'star',owner:p.id,sector:t.sector,d:target.d,targets:list.map(e=>({id:e.id,d:e.d}))});}
 if(st.weather&&(t.weatherAt??0)<=s.time){t.weatherAt=s.time+3500;zone(s,{kind:'weather',owner:p.id,sector:t.sector,d:target.d,start:target.d,until:s.time+(has(p,'longtide')?5000:3000),speed:has(p,'longtide')?55:90,width:100,damage:st.damage*.3,reverse:has(p,'bipolar')});}
 if(st.firetrail&&(t.fireAt??0)<=s.time){t.fireAt=s.time+2500;zone(s,{kind:'fire',owner:p.id,sector:t.sector,d:target.d-(has(p,'backfire')?70:0),until:s.time+3500,width:has(p,'backfire')?180:110,damage:st.damage*.25});}
}
function volleys(s,c,p){
 const f=c.traits[p.id];if(f.gear<4||p.nextVolley>s.time)return;p.nextVolley=s.time+6000;
 const calibrators=s.towers.filter(t=>t.owner===p.id&&CARDS[t.kind].calibrate),towers=s.towers.filter(t=>t.owner===p.id&&CARDS[t.kind].faction==='gear'&&(!t.temporary||f.gear>=6));let index=0;
 for(const t of towers){if(!calibrators.some(x=>distance(PADS[x.pad],PADS[t.pad])<=CARDS[x.kind].range))continue;const st=statsFor(c,t),targets=targetsFor(s,c,t,st);if(!targets.length)continue;const e=targets[has(p,'gears')?index++%targets.length:0];hurt(s,e,st.damage*.85,'physical',p.id);if(has(p,'rails')){const next=targets.filter(x=>x.id!==e.id&&Math.abs(x.d-e.d)<180).sort((a,b)=>Math.abs(a.d-e.d)-Math.abs(b.d-e.d))[0];if(next)hurt(s,next,st.damage*.7,'physical',p.id);}if(has(p,'returnfire'))s.echoes.push({at:s.time+450,sector:t.sector,d:e.d-25,damage:st.damage*.425,owner:p.id,faction:'gear',length:80});emit(s,{type:'volley',kind:t.kind,pad:t.pad,owner:p.id,sector:t.sector,d:e.d});}
}
function heat(s,c,p){
 if(c.traits[p.id].ember<4||p.nextHeat>s.time)return;p.nextHeat=s.time+1000;const burning=living(s,p.sector).filter(e=>e.burnOwner===p.id&&e.burnPrimary&&e.burnUntil>s.time);p.procs.ember=Math.min(24,p.procs.ember+Math.min(4,burning.length));
 const targets=burning.filter(e=>e.fuseOwner===p.id);if(p.procs.ember<12||!targets.length)return;const tower=strongest(s,c,p.id,'ember');if(!tower)return;const damage=statsFor(c,tower).damage*1.7,seen=new Set();p.procs.ember-=12;p.emberBursts++;const centers=has(p,'twins')&&p.emberBursts%2===0?targets.slice(0,2):targets.slice(0,1);
 for(const center of centers){area(s,c,p.sector,center.d,140,damage,'magic',p.id,6,seen);if(!has(p,'emberbox'))center.burnUntil=0;emit(s,{type:'proc',faction:'ember',owner:p.id,sector:p.sector,d:center.d});if(c.traits[p.id].ember>=6)zone(s,{kind:'fire',owner:p.id,sector:p.sector,d:center.d-(has(p,'backfire')?70:0),until:s.time+3000,width:has(p,'backfire')?180:110,damage:damage*.14});}
}
function zones(s,c){
 for(const z of s.zones){if(z.kind==='weather')z.d+=z.speed*STEP/1000;if(z.until<=s.time){if(z.reverse)beam(s,z.sector,Math.max(0,z.start-200),z.damage*2,z.owner,'tide',350);continue;}if(z.kind==='conduct'||z.nextTick>s.time)continue;z.nextTick=s.time+200;
  for(const e of living(s,z.sector).filter(e=>Math.abs(e.d-z.d)<z.width).slice(0,12)){hurt(s,e,z.damage*.2,'magic',z.owner);if(z.kind==='weather')e.wetUntil=s.time+1800;else {if(e.burnUntil<=s.time||e.burnDamage<z.damage*.4){e.burnDamage=z.damage*.4;e.burnOwner=z.owner;e.burnPrimary=false;}e.burnUntil=Math.max(e.burnUntil,s.time+2000);}}
 }s.zones=s.zones.filter(z=>z.until>s.time&&z.d<LENGTH+150);
 for(const e of s.echoes.filter(e=>e.at<=s.time))beam(s,e.sector,e.d,e.damage,e.owner,e.faction,e.length);s.echoes=s.echoes.filter(e=>e.at>s.time).slice(-32);
}
export function combat(s){
 s.towers=s.towers.filter(t=>!t.temporary||t.expires>s.time&&s.towers.some(p=>p.id===t.parent));
 for(const e of s.enemies){if(e.hp<=0)continue;if(e.slowUntil<=s.time)e.slow=1;const wet=e.wetUntil>s.time?.85:1,slow=Math.min(e.slow,wet),boss=['boss','gold','crystal','ancient'].includes(e.kind);e.d+=e.speed*STEP/1000*(boss?Math.max(.7,slow):slow)*Math.min(1.6,1+Math.floor(e.crossings/s.players.length)*.1);
  while(e.d>=LENGTH){const from=e.sector;e.d-=LENGTH;e.sector=(e.sector+1)%s.players.length;e.crossings++;s.players[from].stats.leaks++;if(e.markOwner&&!has(player(s,e.markOwner),'starline'))e.markHits=[];crossedBounty(s,e);emit(s,{type:'leak',enemy:e.id,from,to:e.sector,kind:e.kind});}
  if(e.burnUntil>s.time&&e.burnOwner)hurt(s,e,e.burnDamage*STEP/1000,'magic',e.burnOwner);
  if(e.hp>0&&e.kind==='boss'&&e.summonAt<=s.time){e.summonAt=s.time+6000;for(let i=0;i<3;i++)spawn(s,'slime',e.sector,{origin:e.origin,d:e.d});}
 }
 const c=context(s);
 for(const p of s.players)if(living(s,p.sector).some(e=>e.crossings>0))p.hadRescue=true;
 for(const e of s.enemies)if(e.kind==='shaman'&&e.hp>0)for(const q of living(s,e.sector))if(q.id!==e.id&&distance(pos(c,e),pos(c,q))<130)q.hp=Math.min(q.maxHp,q.hp+q.maxHp*.012*STEP/1000);
 for(const t of [...s.towers])if(t.nextShot<=s.time)shoot(s,c,t);
 for(const p of s.players){heat(s,c,p);volleys(s,c,p);}zones(s,c);s.enemies=s.enemies.filter(e=>e.hp>0);
 for(const p of s.players)if(p.hadRescue&&!living(s,p.sector).some(e=>e.crossings>0)){if(has(p,'night')&&p.nightWave!==s.wave){p.nightWave=s.wave;const skill=p.skillReady.meteor>=p.skillReady.freeze?'meteor':'freeze';p.skillReady[skill]=Math.max(s.time,p.skillReady[skill]-5000);}p.hadRescue=false;}
}
export function skillDamage(s,p,skill,sector,d){
 if(skill==='freeze')for(const e of living(s,sector)){e.slow=['boss','gold','crystal','ancient'].includes(e.kind)?.7:.25;e.slowUntil=s.time+5000;}
 else {const center=pointAt(d);for(const e of living(s,sector))if(distance(pointAt(e.d),center)<=180){if(has(p,'horn')&&!['boss','gold','crystal','ancient'].includes(e.kind)&&(e.knockAt??0)<=s.time){e.d=Math.max(0,e.d-85);e.knockAt=s.time+5000;}hurt(s,e,160*Math.pow(1.15,s.wave-1),'magic',p.id);}}
 s.enemies=s.enemies.filter(e=>e.hp>0);emit(s,{type:'skill',skill,sector,d,owner:p.id});
}
