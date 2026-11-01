import {ensure} from '../../platform/errors.js';
import {CARDS,FACTIONS,RELICS,RECIPES,DIFFICULTIES,SKILLS,LEVEL_COST,LEVEL_WAVE,PADS,LENGTH,WAVES,STEP,commandCap,incomeFor,waveInfo,traits} from './v2-catalog.js';
import {copy,player,emit,spend,owned,usage,giveCard,recruit,makeOffer,availableRelics,offerChoices,craftPlan,canCraft,inventoryCommand,giftCommand,closeGift} from './v2-state.js';
import {spawn,combat,skillDamage} from './v2-combat.js';
import {bountyCommand,tickBounties,finishBounties} from './v2-bounties.js';
const living=s=>s.phase!=='finished';
const rating=s=>!s.won?0:s.peak/s.cap<.5?3:s.peak/s.cap<.85?2:1;
export function create(ids,options={},rng=Math.random){
 ensure(ids.length>=1&&ids.length<=4&&new Set(ids).size===ids.length,'支持1至4位不同玩家');const difficulty=options.difficulty??'normal';ensure(Object.hasOwn(DIFFICULTIES,difficulty),'难度无效');
 const s={version:2,mode:'draft',difficulty,phase:'prepare',wave:1,time:0,waveStartedAt:0,phaseUntil:35000,cap:Math.round(DIFFICULTIES[difficulty].cap*ids.length+20),peak:0,won:false,totalKills:0,finalReinforcements:0,randomState:(Math.floor(rng()*4294967296)>>>0)||0x12345678,nextCardId:1,nextEnemyId:1,nextOfferId:1,nextGiftId:1,nextBountyId:1,nextZoneId:1,eventSeq:0,events:[],towers:[],enemies:[],zones:[],echoes:[],gifts:[],bounties:[],spawnPlan:[],spawnCursor:0,players:[]};
 for(const [sector,id] of ids.entries()){
  const faction=Object.keys(FACTIONS)[sector%4],p={id,sector,faction,started:false,seq:0,ready:false,gold:120,recruitLevel:1,freeRecruit:1,cores:0,inventory:[],pending:[],offers:[],relics:[],bountyRelic:null,pity:{miss:[0,0,0,0],obtainedOrange:false},wishes:[],shipping:0,receiving:0,bountiesUsed:0,bountyCancelWave:0,skillReady:{meteor:0,freeze:0},procs:{tide:0,ember:0,star:0},nextTide:0,nextHeat:0,nextVolley:0,emberBursts:0,hadRescue:false,nightWave:0,craneWave:0,lastSignal:-10000,combo:0,lastKill:-10000,stats:{kills:0,damage:0,rescues:0,leaks:0,invested:0,income:0,peakCombo:0,draws:0,merges:0,evolutions:0,gifts:0,bounties:0,firstLegendWave:null}};
  s.players.push(p);giveCard(s,p,`${faction}0`);giveCard(s,p,`${faction}1`);
 }return s;
}
function beginWave(s){
 s.phase='combat';s.waveStartedAt=s.time;s.phaseUntil=s.time+DIFFICULTIES[s.difficulty].waveMs;s.spawnCursor=0;s.spawnPlan=[];const info=waveInfo(s.wave);
 for(const p of s.players){p.started=true;p.ready=false;for(let i=0;i<info.count;i++)s.spawnPlan.push({at:s.time+i*620+p.sector*160,kind:i%5===0&&s.wave>3?'slime':info.kind,sector:p.sector});if(info.boss)s.spawnPlan.push({at:s.time+4500+p.sector*200,kind:'boss',sector:p.sector});}
 s.spawnPlan.sort((a,b)=>a.at-b.at);emit(s,{type:'wave',wave:s.wave});
}
function rewardWave(s){
 for(const p of s.players){if(p.freeRecruit)recruit(s,p,true);if(s.wave<18){const amount=incomeFor(s.wave);p.gold+=amount;p.stats.income+=amount;emit(s,{type:'income',owner:p.id,amount});}
  if([3,7,11,15].includes(s.wave))makeOffer(s,p,'supply',Object.keys(CARDS).filter(k=>CARDS[k].rarity<=1));
  if([4,9,14].includes(s.wave))makeOffer(s,p,'relic',availableRelics(s,p,{start:s.wave===4}),{start:s.wave===4});
  if([8,12].includes(s.wave))p.cores++;
 }
}
function nextWave(s){
 rewardWave(s);s.wave++;s.phase='prepare';s.phaseUntil=s.time+([6,12,18].includes(s.wave)?25000:12000);
 if(s.wave%2===0){for(const g of [...s.gifts])closeGift(s,g);for(const p of s.players){p.shipping=Math.min(2,p.shipping+1);p.receiving=0;}}
 for(const p of s.players){p.freeRecruit=1;p.ready=false;}
}
function finish(s){s.peak=Math.max(s.peak,s.enemies.length);if(s.enemies.length>s.cap){s.phase='finished';s.won=false;emit(s,{type:'defeat'});}else if(s.phase==='combat'&&s.wave===18&&s.spawnCursor>=s.spawnPlan.length&&!s.enemies.length&&!s.bounties.some(b=>b.status==='warning')){s.phase='finished';s.won=true;emit(s,{type:'victory'});}}
export function apply(state,id,c){
 ensure(living(state),'本场远航已结束');ensure(c&&typeof c.type==='string','操作无效');const s=copy(state),p=player(s,id);p.seq++;if(c.type!=='starter')p.started=true;
 for(const g of [...s.gifts])if(g.expires<=s.time)closeGift(s,g);
 if(inventoryCommand(s,p,c)||giftCommand(s,p,c)||bountyCommand(s,p,c)){}
 else if(c.type==='ready'){ensure(s.phase==='prepare','战斗已经开始');p.ready=true;if(s.players.every(x=>x.ready))beginWave(s);}
 else if(c.type==='skill'){
  ensure(Object.hasOwn(SKILLS,c.skill),'技能无效');ensure(Number.isInteger(c.sector)&&s.players[c.sector],'防区无效');ensure(p.skillReady[c.skill]<=s.time,'技能冷却中');ensure(s.phase==='combat'||s.enemies.length,'等待敌人出现');if(c.skill==='meteor')ensure(Number.isFinite(c.d)&&c.d>=0&&c.d<=LENGTH,'请选择地图落点');p.skillReady[c.skill]=s.time+SKILLS[c.skill].cooldown;skillDamage(s,p,c.skill,c.sector,c.d??LENGTH/2);
 }else if(c.type==='signal'){ensure(['help','wait','ready'].includes(c.signal),'信号无效');ensure(s.time-p.lastSignal>=10000,'稍后再发信号');p.lastSignal=s.time;emit(s,{type:'signal',owner:p.id,signal:c.signal,sector:p.sector});}
 else ensure(false,'未知操作');
 finishBounties(s);finish(s);return s;
}
function step(s){
 s.time+=STEP;for(const g of [...s.gifts])if(g.expires<=s.time)closeGift(s,g);
 if(s.phase==='prepare'&&s.time>=s.phaseUntil)beginWave(s);
 if(s.phase==='combat')while(s.spawnCursor<s.spawnPlan.length&&s.spawnPlan[s.spawnCursor].at<=s.time){const next=s.spawnPlan[s.spawnCursor++];spawn(s,next.kind,next.sector);}
 tickBounties(s,spawn);combat(s);finishBounties(s);finish(s);if(!living(s))return;
 if(s.phase==='combat'&&s.wave<18&&(s.time>=s.phaseUntil||s.time-s.waveStartedAt>=28000&&s.spawnCursor>=s.spawnPlan.length&&!s.enemies.length))nextWave(s);
 if(s.phase==='combat'&&s.wave===18&&s.time>=s.phaseUntil+120000+s.finalReinforcements*10000){const count=5*2**Math.min(s.finalReinforcements,6);for(const p of s.players)for(let i=0;i<count;i++)spawn(s,'crab',p.sector);s.finalReinforcements++;emit(s,{type:'reinforcements',count});finish(s);}
}
export function advance(state,steps){ensure(Number.isInteger(steps)&&steps>=1&&steps<=20,'模拟步数无效');if(!living(state))return state;const s=copy(state);for(let i=0;i<steps&&living(s);i++)step(s);return s;}
const cardView=c=>c?{id:c.id,kind:c.kind,star:c.star,received:c.received,locked:c.locked,gift:c.gift??null}:null;
function achievements(s,p){return [p.stats.merges>=4&&'合成工匠',p.stats.evolutions>=2&&'进化先行者',p.stats.gifts>=2&&'同舟补给',p.stats.bounties>=1&&'悬赏猎手',p.stats.rescues>=15&&'同舟救援者',s.won&&'群岛守望者'].filter(Boolean);}
export function view(s,id){
 const p=s.players.find(x=>x.id===id),publicPlayers=s.players.map(q=>({id:q.id,sector:q.sector,faction:q.faction,gold:q.gold,recruitLevel:q.recruitLevel,ready:q.ready,relics:[...q.relics],bountyRelic:q.bountyRelic,wishes:[...q.wishes],traits:traits(s.towers,q.id),command:usage(s,q),commandCap:commandCap(s.wave),shipping:q.shipping,receiving:q.receiving,bountiesUsed:q.bountiesUsed,stats:{...q.stats,damage:Math.floor(q.stats.damage)},achievements:achievements(s,q)}));
 const self=p?{id:p.id,sector:p.sector,seq:p.seq,started:p.started,canRecall:s.phase==='prepare'||(p.relics.includes('crane')||p.bountyRelic==='crane')&&p.craneWave!==s.wave,inventory:p.inventory.map(cardView),pending:p.pending.map(cardView),offers:p.offers.map(o=>({...copy(o),choices:copy(offerChoices(s,p,o))})),freeRecruit:p.freeRecruit,cores:p.cores,pity:copy(p.pity),skillReady:copy(p.skillReady),recipes:RECIPES.map(r=>{const plan=craftPlan(s,p,r);return {...r,plan,canCraft:canCraft(s,p,r,plan)};}),gifts:s.gifts.filter(g=>g.from===p.id||g.to===p.id).map(g=>({...g,card:cardView(player(s,g.from).inventory.find(c=>c.id===g.card))})),mergePairs:Object.keys(CARDS).map(kind=>owned(s,p).filter(c=>c.kind===kind&&c.star===1&&!c.locked&&!c.gift).slice(0,2).map(c=>c.id)).filter(a=>a.length===2)}:null;
 return {version:2,mode:'draft',phase:s.phase,wave:s.wave,time:s.time,phaseUntil:s.phaseUntil,cap:s.cap,peak:s.peak,won:s.won,rating:rating(s),totalKills:s.totalKills,finalReinforcements:s.finalReinforcements,remainingSpawns:s.spawnPlan.length-s.spawnCursor,waveInfo:waveInfo(s.wave),nextWave:s.wave<18?waveInfo(s.wave+1):null,players:publicPlayers,self,
  towers:s.towers.map(t=>({id:t.id,kind:t.kind,star:t.star,owner:t.owner,sector:t.sector,pad:t.pad,target:t.target,locked:t.owner===id?t.locked:undefined,received:t.owner===id?t.received:undefined,temporary:!!t.temporary,offsetX:t.offsetX??0})),
  enemies:s.enemies.map(e=>({id:e.id,kind:e.kind,sector:e.sector,origin:e.origin,d:Math.round(e.d*100)/100,hp:Math.ceil(e.hp),maxHp:e.maxHp,speed:e.speed,slow:Math.min(e.slow,e.wetUntil>s.time?.85:1),crossings:e.crossings,wet:e.wetUntil>s.time,burning:e.burnUntil>s.time,marked:e.markUntil>s.time,bounty:e.bounty??null,sourceBounty:e.sourceBounty??null})),
  zones:s.zones.map(z=>({id:z.id,kind:z.kind,owner:z.owner,sector:z.sector,d:z.d,width:z.width,until:z.until})),bounties:s.bounties.filter(b=>b.status!=='cancelled').map(b=>({id:b.id,owner:b.owner,kind:b.kind,reward:b.reward,status:b.status,spawnAt:b.spawnAt,cancelUntil:b.cancelUntil,deadline:b.deadline??null,depositLost:b.depositLost,leaked:b.leaked,enemy:b.enemy??null,success:b.success??null})),events:s.events.filter(e=>!['recruit','income','choice'].includes(e.type)||e.owner===id).map(e=>copy(e))};
}
export function decide(v,id){
 if(v.phase==='finished'||!v.self)return null;const p=v.players.find(x=>x.id===id),self=v.self,f=p.faction,mine=v.towers.filter(t=>t.owner===id&&!t.temporary),all=[...self.inventory,...mine],count=kind=>all.filter(c=>c.kind===kind).reduce((n,c)=>n+(c.star===2?2:1),0),field=kind=>mine.some(t=>t.kind===kind);
 if(!self.started)return {type:'starter',faction:f};
 const incomingGift=self.gifts.find(g=>g.to===id);if(incomingGift&&self.inventory.length<8)return {type:'acceptGift',gift:incomingGift.id};
 const offer=self.offers[0];if(offer){let choice;if(offer.kind==='relic'||offer.kind==='bountyRelic')choice=offer.choices.find(k=>RELICS[k]?.faction===f)??offer.choices[0];else choice=offer.choices.includes(`${f}3`)?`${f}3`:offer.choices.find(k=>CARDS[k]?.faction===f)??offer.choices[0];if(choice)return {type:'chooseOffer',offer:offer.id,choice};}
 if(self.pending.length&&self.inventory.length<8)return {type:'claimCard',card:self.pending[0].id};
 if(self.mergePairs.length){const pair=self.mergePairs.sort((a,b)=>CARDS[all.find(x=>x.id===b[0]).kind].rarity-CARDS[all.find(x=>x.id===a[0]).kind].rarity)[0];return {type:'merge',cards:pair};}
 const craft=self.recipes.filter(r=>r.canCraft&&CARDS[r.result].faction===f&&count(r.result)<2).sort((a,b)=>CARDS[b.result].rarity-CARDS[a.result].rarity).find(r=>CARDS[r.result].rarity>=2||all.length>8);
 if(craft){const consumed=craft.plan.map(x=>all.find(c=>c.id===x.id)),delta=CARDS[craft.result].command-consumed.filter(x=>x.pad!==undefined).reduce((n,x)=>n+CARDS[x.kind].command,0);if(!consumed.some(x=>x.pad!==undefined)||p.command+delta<=p.commandCap)return {type:'craft',recipe:craft.id,materials:craft.plan.map(x=>x.id)};}
 const free=PADS.find(pad=>!mine.some(t=>t.pad===pad.id)),value=c=>CARDS[c.kind].rarity*8+c.star*4+(CARDS[c.kind].faction===f?5:0)+(field(c.kind)?0:3),candidates=self.inventory.filter(c=>!c.gift&&p.command+CARDS[c.kind].command<=p.commandCap&&(CARDS[c.kind].rarity!==3||mine.filter(t=>CARDS[t.kind].rarity===3).length<2)).sort((a,b)=>value(b)-value(a));
 if(free&&candidates.length)return {type:'deploy',card:candidates[0].id,pad:free.id};
 const threats=v.enemies.filter(e=>e.sector===p.sector);if(threats.length>10&&self.skillReady.meteor<=v.time)return {type:'skill',skill:'meteor',sector:p.sector,d:threats[Math.floor(threats.length/2)].d};if(threats.length>14&&self.skillReady.freeze<=v.time)return {type:'skill',skill:'freeze',sector:p.sector};
 if(p.recruitLevel<5&&v.wave>=LEVEL_WAVE[p.recruitLevel]&&p.gold>=LEVEL_COST[p.recruitLevel])return {type:'recruitLevel'};
 if(self.freeRecruit&&self.inventory.length<8&&!self.pending.length)return {type:'recruit'};
 const reserve=p.recruitLevel<5&&v.wave>=LEVEL_WAVE[p.recruitLevel]-1?LEVEL_COST[p.recruitLevel]:0;
 if(p.gold>=40+reserve&&self.inventory.length<8&&!self.pending.length)return {type:'recruit'};
 if(self.inventory.length>=7||self.pending.length){const expendable=self.inventory.filter(c=>!c.locked&&!c.gift&&CARDS[c.kind].faction!==f).sort((a,b)=>value(a)-value(b))[0];if(expendable)return {type:'recycle',card:expendable.id};}
 const incoming=[...self.inventory].sort((a,b)=>value(b)-value(a))[0],weak=mine.filter(c=>!c.locked&&CARDS[c.kind].faction!==f).sort((a,b)=>value(a)-value(b))[0];if(incoming&&weak&&value(incoming)>value(weak)+2)return {type:'recycle',card:weak.id};
 if(v.phase==='prepare'&&!p.ready)return {type:'ready'};return null;
}
export const draft={create,apply,view,spectatorView:s=>view(s,null),isFinished:s=>s.phase==='finished',realtime:{stepMs:STEP,commitMs:200,advance},submissionKey:(s,id)=>living(s)&&s.players.some(p=>p.id===id)?`tidewatch:${player(s,id).seq}`:null,
 result:s=>({winners:s.won?s.players.map(p=>p.id):[],rounds:s.wave,scoreDirection:'higher',players:s.players.map(p=>({id:p.id,rank:1,score:Math.floor(p.stats.damage/100+p.stats.rescues*5),breakdown:[{label:'远航星级',value:rating(s)},{label:'抵御波次',value:s.wave},{label:'消灭怪物',value:p.stats.kills},{label:'完成进化',value:p.stats.evolutions},{label:'队友补给',value:p.stats.gifts},{label:'完成悬赏',value:p.stats.bounties}]}))}),bot:{observe:()=>null,decide}};
