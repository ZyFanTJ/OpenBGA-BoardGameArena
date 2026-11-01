import {writeFileSync,mkdirSync} from 'node:fs';
// Diagnostic fixture: two legendary and two epic towers per player, all two-star.
// This checks reward reachability, not the likelihood of acquiring this army.
mkdirSync('work/tidewatch-v2',{recursive:true});
import {tidewatchV2 as g} from '../packages/games/tidewatch/v2-adapter.js';
import {giveCard} from '../packages/games/tidewatch/v2-state.js';
import {RELICS} from '../packages/games/tidewatch/v2-catalog.js';
const results=[];
for(const kind of ['gold','crystal','ancient']){
 let s=g.create(['p0','p1','p2','p3'],{},()=>.3);s.wave=12;s.phase='combat';s.phaseUntil=1e9;s.spawnPlan=[{at:1e9,kind:'slime',sector:0}];
 for(const id of s.players.map(p=>p.id)){let p=s.players.find(p=>p.id===id);p.gold=100;p.inventory=[];p.relics=Object.keys(RELICS).filter(k=>RELICS[k].faction===p.faction);for(let i=0;i<8;i++){p=s.players.find(p=>p.id===id);const c=giveCard(s,p,p.faction+[0,1,2,3,4,5,5,4][i],{star:2});s=g.apply(s,id,{type:'deploy',card:c.id,pad:[0,5,1,6,2,7,9,4][i]});s=g.apply(s,id,{type:'target',tower:c.id,target:'strong'});}}
 s=g.apply(s,'p0',{type:'signBounty',kind,reward:kind==='gold'?'gold':kind==='crystal'?'card':'core'});
 for(let i=0;i<900&&!g.isFinished(s);i++){const body=s.enemies.find(e=>e.bounty);if(body&&i%5===0)for(const p of s.players){if(p.skillReady.meteor<=s.time)s=g.apply(s,p.id,{type:'skill',skill:'meteor',sector:body.sector,d:body.d});}s=g.realtime.advance(s,4);if(s.bounties[0].status==='cleared')break;}
 results.push({kind,seconds:s.time/1000,contract:s.bounties[0].status,success:s.bounties[0].success,leaked:s.bounties[0].leaked,peak:s.peak,cap:s.cap,boss:s.enemies.find(e=>e.bounty)?.hp});
}
writeFileSync('work/tidewatch-v2/prepared-bounty.json',JSON.stringify(results,null,2));console.log(results);

