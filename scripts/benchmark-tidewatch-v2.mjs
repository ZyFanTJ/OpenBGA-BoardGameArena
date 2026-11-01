import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tidewatchV2 as g} from '../packages/games/tidewatch/v2-adapter.js';
import {CARDS,ENEMIES,LENGTH,PADS} from '../packages/games/tidewatch/v2-catalog.js';
import {giveCard} from '../packages/games/tidewatch/v2-state.js';
import {spawn} from '../packages/games/tidewatch/v2-combat.js';
import {SqliteStore} from '../packages/platform/sqlite-store.js';
import {RoomService} from '../packages/platform/rooms.js';
import {createRegistry} from '../packages/games/registry.js';
const stressCount=Number(process.argv.find(a=>a.startsWith('--stress-count='))?.split('=')[1]??400);if(!Number.isInteger(stressCount)||stressCount<1||stressCount>400)throw new Error('Stress count must be 1..400');const suffix=stressCount===400?'':'-'+stressCount;
const out='work/tidewatch-v2';mkdirSync(out,{recursive:true});const stressOnly=process.argv.includes('--stress-only'),scenarioOnly=process.argv.includes('--scenario-only');const results=stressOnly||scenarioOnly?JSON.parse(readFileSync(out+'/balance-v2.json','utf8')):[];
function simulate({difficulty='normal',players=1,seed=73,faction,scenario='baseline'}){
 let r=seed,s=g.create(Array.from({length:players},(_,i)=>'p'+i),{difficulty},()=>((r=Math.imul(r,1664525)+1013904223)>>>0)/4294967296);if(faction)s.players[0].faction=faction;const begin=performance.now();let maxContracts=0;
 for(let frame=0;frame<9000&&!g.isFinished(s);frame++){
  if(frame%3===0)for(const p of s.players){let c;
   const shouldSign=scenario==='greedy'?s.wave>=10&&p.sector<Math.min(2,players):scenario==='safe'?s.wave>=8&&p.sector===0:scenario==='coordinated'?s.wave>=10&&p.sector===0:false;
   const kind=scenario==='greedy'||scenario==='coordinated'?'ancient':'gold',cost=kind==='ancient'?60:20;
   if(shouldSign&&p.bountiesUsed===0&&p.gold>=cost&&!s.bounties.some(b=>b.owner===p.id&&['warning','active','failed'].includes(b.status))&&s.bounties.filter(b=>['warning','active','failed'].includes(b.status)).length<Math.min(2,players))c={type:'signBounty',kind,reward:kind==='ancient'?'core':'gold'};
   else {const boss=s.enemies.find(e=>e.bounty&&e.sector===p.sector&&e.hp>0),retarget=s.towers.find(t=>t.owner===p.id&&!t.temporary&&t.target!=='strong');if(scenario==='coordinated'&&boss&&p.skillReady.meteor<=s.time)c={type:'skill',skill:'meteor',sector:p.sector,d:boss.d};else if(scenario==='coordinated'&&boss&&retarget)c={type:'target',tower:retarget.id,target:'strong'};else c=g.bot.decide(g.view(s,p.id),p.id);}
   if(c)s=g.apply(s,p.id,c);
  }
  s=g.realtime.advance(s,4);maxContracts=Math.max(maxContracts,s.bounties.filter(b=>['active','failed'].includes(b.status)).length);
  if(!faction&&players===4&&difficulty==='normal'&&scenario==='baseline'&&s.wave===10&&!globalThis.savedShowcase){writeFileSync(out+'/showcase-state.json',JSON.stringify(s));writeFileSync(out+'/showcase-view.json',JSON.stringify(g.view(s,'p0')));globalThis.savedShowcase=true;}
 }
 const result={difficulty,players,seed,faction:faction??'mixed',scenario,won:s.won,finished:g.isFinished(s),wave:s.wave,seconds:s.time/1000,peak:s.peak,cap:s.cap,draws:s.players.map(p=>p.stats.draws),merges:s.players.map(p=>p.stats.merges),evolutions:s.players.map(p=>p.stats.evolutions),bounties:s.bounties.map(b=>({kind:b.kind,status:b.status,success:b.success??false,leaked:b.leaked})),maxContracts,cpuMs:Math.round(performance.now()-begin)};results.push(result);writeFileSync(out+'/balance-v2.json',JSON.stringify(results,null,2));console.log(JSON.stringify(result));
}
if(!stressOnly&&!scenarioOnly)for(const difficulty of ['practice','normal','storm'])for(const players of [1,2,4])for(const seed of [73,219])simulate({difficulty,players,seed});
if(!stressOnly&&!scenarioOnly)for(const faction of ['ember','gear','star'])simulate({faction});
if(!stressOnly)for(const scenario of scenarioOnly?['coordinated']:['safe','greedy','coordinated'])for(const seed of [73,219])simulate({players:4,seed,scenario});
let s=g.create(['p0','p1','p2','p3'],{},()=>.3);s.wave=18;s.phase='combat';s.phaseUntil=1e9;s.spawnPlan=[{at:1e9,kind:'slime',sector:0}];s.cap=1000;
for(const p of s.players){p.inventory=[];for(const pad of PADS){const kind=p.faction+(pad.id<2?5:pad.id%4),card=giveCard(s,s.players.find(q=>q.id===p.id),kind,{star:2});s=g.apply(s,p.id,{type:'deploy',card:card.id,pad:pad.id});}}
for(let i=0;i<stressCount;i++)spawn(s,['slime','crab','shell','jelly','swarm','shaman','boss'][i%7],i%4,{d:i/stressCount*LENGTH,hp:10000,maxHp:10000});
const samples=[];for(let i=0;i<100;i++){const t=performance.now(),next=g.realtime.advance(s,4);for(const p of s.players)JSON.stringify(g.view(next,p.id));samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);
const perf={enemies:stressCount,towers:48,steps:4,views:4,samples:100,p50Ms:samples[50],p95Ms:samples[95],maxMs:samples.at(-1),snapshotBytes:Buffer.byteLength(JSON.stringify(g.view(s,'p0')))};
const store=new SqliteStore(out+'/performance-'+Date.now()+'.sqlite'),rooms=new RoomService(store,createRegistry([g]));store.transaction(data=>{data.rooms.PERF0001={id:'PERF0001',title:'V2 isolated stress',gameId:'tidewatch',stateVersion:2,options:{},hostId:'p0',players:s.players.map((p,seat)=>({id:p.id,name:p.id,seat,ready:true})),status:'playing',revision:0,matchId:'v2-performance',chat:[],game:structuredClone(s),createdAt:Date.now()};});
const disk=[];for(let i=0;i<100;i++){const room=store.data.rooms.PERF0001,t=performance.now();rooms.advanceRealtime(room.id,{revision:room.revision,matchId:room.matchId,steps:4});for(const p of s.players)JSON.stringify(rooms.snapshot(room.id,{id:p.id}));disk.push(performance.now()-t);}disk.sort((a,b)=>a-b);store.close();const persistence={samples:100,p50Ms:disk[50],p95Ms:disk[95],maxMs:disk.at(-1)};writeFileSync(out+'/performance-v2'+suffix+'.json',JSON.stringify({perf,persistence},null,2));writeFileSync(out+'/stress-view-v2'+suffix+'.json',JSON.stringify(g.view(s,'p0')));console.log(JSON.stringify({perf,persistence}));
