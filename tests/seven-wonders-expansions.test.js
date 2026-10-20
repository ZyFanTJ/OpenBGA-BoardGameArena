import test from 'node:test';
import assert from 'node:assert/strict';
import {sevenWonders as g,production,paymentPlans,buildQuote,scores,navalResults} from '../packages/games/seven-wonders/index.js';
import {card,WONDERS} from '../packages/games/seven-wonders/data.js';
import {LEADERS} from '../packages/games/seven-wonders/leaders.js';
import {ARMADA_CARDS,ISLANDS,SHIPYARDS} from '../packages/games/seven-wonders/armada.js';
import {wonderQuote,navalStrength} from '../packages/games/seven-wonders/economy.js';
import {JsonStore} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {RoomService} from '../packages/platform/rooms.js';
import {games} from '../packages/games/registry.js';
import {createApp} from '../apps/server/http.js';
import {createSevenWondersRenderer} from '../apps/web/games/seven-wonders/index.js';
const ids=['a','b','c'];const rng=initial=>{let seed=initial;return ()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);};
const fresh=(options={leaders:true,armada:true})=>g.create(ids,{side:'day',...options},rng(18));
function clean(options){const s=fresh(options);Object.assign(s,{phase:'draft',round:1,pending:{},tasks:[],exploreQueue:[],turnEffects:[],taxEvents:[],pirateEvents:[],reviveQueue:[],boardings:[],lastActions:[]});for(const p of s.players)Object.assign(p,{wonder:'giza',side:'day',coins:30,cards:[],stages:0,builtStages:[],leaders:[],leaderHand:[],military:[],navalMilitary:[],islands:[],mummies:[],hand:[],fleets:s.expansions.armada?{red:0,yellow:0,blue:0,green:0}:undefined,shipyard:0,refundUsed:[],bankBonusUsed:false,bankResourceUsed:false});return s;}
const command=(s,id,c)=>g.apply(s,id,{...c,epoch:s.epoch},{random:rng(7)});
function play(s,index,cardId,action='build',extra={}){return command(s,ids[index],{type:'choose',cardId,action,...extra});}
function resolveHand(s,choices={}){for(const p of [...s.players])if(p.hand.length&&!s.pending[p.id])s=command(s,p.id,choices[p.id]??{type:'choose',cardId:p.hand[0],action:'sell'});return s;}
function hand(s,cards){s.players.forEach((p,i)=>{p.hand=[cards[i]??'1-altar@0','1-theater@extra'+i];});return s;}

test('second-edition expansion manifests match printed counts, player marks and special wonders',()=>{
 assert.equal(Object.values(LEADERS).filter(c=>!c.expert).length,34);assert.equal(Object.values(LEADERS).filter(c=>c.expert).length,15);
 assert.equal(Object.keys(ARMADA_CARDS).length,24);assert.equal(Object.keys(ISLANDS).length,27);assert.equal(SHIPYARDS.length,7);
 for(const age of [1,2,3])assert.equal(Object.values(ARMADA_CARDS).filter(c=>c.age===age).length,8);
 assert.equal(Object.values(ARMADA_CARDS).filter(c=>c.copies[0]===4).length,5);
 assert.equal(card('3-armada-headquarters').cost.resources,'sscwp');assert.equal(card('3-armada-pier').cost.resources,'cccpt');assert.equal(SHIPYARDS[0].costs.green[1].coins,2);assert.equal(SHIPYARDS[0].costs.green[1].resources,'');assert.equal(card('1-armada-hideout').effect.pirate,true);assert.equal(card('1-armada-hideout').effect.tax,undefined);
 assert.equal(WONDERS['abu-simbel'].resource,'c');assert.equal(WONDERS.siracusa.day[2].effect.shields,1);assert.equal(WONDERS.siracusa.day[2].effect.reduceNaval,undefined);
 assert.throws(()=>fresh({leaderExpert:true,leaders:false}));assert.throws(()=>fresh({armada:'yes'}));
});

test('leaders draft right in secret, automatically keep fourth, start with six coins and recruit before each age',()=>{
 let s=fresh({leaders:true}),before=structuredClone(s);assert.equal(s.phase,'leaderDraft');assert.ok(s.players.every(p=>p.coins===6&&p.hand.length===0&&p.draftLeaders.length===4));
 const secondHand=s.players[1].draftLeaders.slice(1);s=command(s,'a',{type:'leaderPick',cardId:s.players[0].draftLeaders[0]});assert.deepEqual(before.players[0].leaderHand,[]);
 const other=g.view(s,'b');assert.equal(other.pending,null);assert.equal(other.draftedLeaders.length,0);assert.ok(!JSON.stringify(other).includes(s.players[0].leaderHand[0]??'never-secret'));
 for(const id of ['b','c'])s=command(s,id,{type:'leaderPick',cardId:s.players.find(p=>p.id===id).draftLeaders[0]});assert.deepEqual(s.players[0].draftLeaders,secondHand);
 while(s.phase==='leaderDraft')for(const id of ids)s=command(s,id,{type:'leaderPick',cardId:s.players.find(p=>p.id===id).draftLeaders[0]});
 assert.equal(s.phase,'recruit');assert.ok(s.players.every(p=>p.leaderHand.length===4));
 for(const id of ids){const p=s.players.find(p=>p.id===id);s=command(s,id,{type:'choose',cardId:p.leaderHand[0],action:'sell'});}
 assert.equal(s.phase,'draft');assert.ok(s.players.every(p=>p.hand.length===7&&p.leaderHand.length===3&&p.coins===9));assert.ok(s.discard.every(id=>card(id).age>0));
});

test('Armada deals eight cards, adds exactly player-count cards per age, excludes 4+ components for three players',()=>{
 for(let n=3;n<=7;n++){const s=g.create(Array.from({length:n},(_,i)=>String(i)),{side:'day',armada:true},rng(n));for(const deck of [s.players.flatMap(p=>p.hand),s.decks[1],s.decks[2]]){assert.equal(deck.length,n*8);assert.equal(deck.filter(id=>card(id).expansion==='armada').length,n);if(n===3)assert.ok(deck.every(id=>card(id).expansion!=='armada'||card(id).copies[0]===3));}}
});

test('combined building/ship payment cannot reuse production, chain still pays naval costs, leaders reduce only building resources',()=>{
 const s=clean(),p=s.players[0];p.wonder='alexandria';p.cards=['1-stockade@0'];p.fleets.red=1;p.coins=0;s.players[1].wonder='alexandria';s.players[2].wonder='alexandria';
 // Archery requires ww/o, ship step requires glass; the single own glass covers only the ship.
 p.cards=['1-workshop@0'];assert.equal(buildQuote(s,p,'2-archery@0').plans[0].reason,'chain');const q=buildQuote(s,p,'2-archery@0',true,'red');assert.ok(q.plans.length);assert.equal(q.plans[0].bank,0);assert.equal(q.plans[0].sources.filter(x=>x.resource==='g').length,1);
 p.cards=['1-ore@0'];p.wonder='rhodes';p.fleets.red=0;assert.ok(buildQuote(s,p,'1-barracks@0',true,'red').plans.length);p.cards=[];assert.equal(buildQuote(s,p,'1-barracks@0',false,'red').plans.length,0); // one ore cannot pay twice
 p.leaders=['leader-leonidas'];assert.ok(buildQuote(s,p,'1-barracks@0',false,'red').plans.length);
});

test('Armada shifts Olympia last construction to seventh normal action and presents the same rule on both setup and city views',()=>{
 const s=clean(),p=s.players[0];Object.assign(p,{wonder:'olympia',side:'night',stages:2,builtStages:[0,1],coins:0,hand:['3-palace@0']});s.round=6;assert.equal(buildQuote(s,p,p.hand[0]).plans.length,0);s.round=7;assert.equal(buildQuote(s,p,p.hand[0]).plans[0].reason,'wonder');const v=g.view(s,'a');assert.match(v.players[0].stageList[1].text,/7/);assert.equal(v.players[0].stageList[1].effect.freeLastAt,7);s.phase='setup';p.side=null;p.stages=0;p.builtStages=[];assert.match(g.view(s,'a').setupChoices.find(c=>c.side==='night').stages[1].text,/7/);
});

test('Bilkis reserve resource is paid once and cannot fill two missing resources; island production stays private to own economy',()=>{
 const s=clean(),p=s.players[0];p.wonder='giza';s.players[1].wonder='giza';s.players[2].wonder='giza';p.leaders=['leader-bilkis'];p.coins=1;
 assert.ok(paymentPlans(s,p,{resources:'g',coins:0}).some(q=>q.bank===1&&q.reserve===1));assert.equal(paymentPlans(s,p,{resources:'gg',coins:0}).length,0);
 p.islands=['island-abandoned'];assert.ok(production(p).some(r=>r.includes('g')));assert.ok(!production(p,true).some(r=>r.includes('g')));
});

test('Rome discounts stack with neighboring Rome and Maecenas; Olympia never makes leader free',()=>{
 const s=clean(),p=s.players[0];p.wonder='roma';p.side='day';assert.equal(buildQuote(s,p,'leader-caesar').plans[0].bank,0);
 p.side='night';assert.equal(buildQuote(s,p,'leader-caesar').plans[0].bank,3);assert.equal(buildQuote(s,s.players[1],'leader-caesar').plans[0].bank,4);
 p.wonder='olympia';p.stages=2;p.builtStages=[0,1];assert.equal(buildQuote(s,p,'leader-caesar').plans[0].bank,5);p.leaders=['leader-maecenas'];assert.equal(buildQuote(s,p,'leader-caesar').plans[0].bank,0);
});

test('recruitment benefits never finance same-round recruitment, and sold leaders cannot be revived',()=>{
 let s=clean();s.phase='recruit';for(const p of s.players){p.coins=1;p.leaderHand=['leader-croesus'];}s=command(s,'a',{type:'choose',cardId:'leader-croesus',action:'build'});assert.equal(s.players[0].coins,1);assert.equal(g.view(s,'b').players[0].leaders.length,0);
 for(const id of ['b','c'])s=command(s,id,{type:'choose',cardId:'leader-croesus',action:'sell'});assert.equal(s.players[0].coins,6);assert.equal(s.discard.length,0);
});

test('paid naval and free card advance both apply, with distinct fleets in multi-advance abilities',()=>{
 let s=hand(clean(),['1-armada-construction','1-altar@0','1-theater@0']);s.players[0].wonder='giza';s.players[0].cards=['1-lumber@0'];s.players[0].coins=30;
 s=play(s,0,s.players[0].hand[0],'build',{naval:'blue'});s=resolveHand(s);assert.equal(s.players[0].fleets.blue,1);assert.equal(s.phase,'ability');
 s=command(s,'a',{type:'ability',value:'blue'});assert.equal(s.players[0].fleets.blue,2);assert.equal(s.phase,'draft');
 s.tasks=[{playerId:'a',kind:'advance',remaining:2,used:[]}];s.phase='ability';s=command(s,'a',{type:'ability',value:'red'});assert.throws(()=>command(s,'a',{type:'ability',value:'red'}),/尚未推进/);s=command(s,'a',{type:'ability',value:'yellow'});assert.equal(s.players[0].fleets.yellow,1);
});

test('selling advances yellow instead of granting three coins and still triggers shipyard income/taxes',()=>{
 let s=hand(clean(),['1-altar@0']);const p=s.players[0];p.fleets.yellow=1;const coins=p.coins;s=play(s,0,p.hand[0],'sell',{sellFleet:true});s=resolveHand(s);assert.equal(s.players[0].fleets.yellow,2);assert.equal(s.players[0].coins,coins+2);assert.equal(s.players[1].coins,32);assert.ok(s.lastActions[0].sellFleet);
});

test('taxes use only highest value, after income; commercial level and protection reduce losses and money stays non-negative',()=>{
 let s=hand(clean(),['1-armada-hideout','2-armada-den','1-altar@0']);s.players[0].fleets.yellow=3;s.players[0].cards=['1-press@0'];s.players[1].fleets.yellow=1;s.players[1].cards=['1-loom@0'];s.players[2].coins=0;s.players[2].islands=['island-foggy'];s.players.push({...structuredClone(s.players[2]),id:'d',coins:10,islands:[],hand:['1-altar@d','1-theater@d']});s=play(s,0,s.players[0].hand[0],'build',{naval:'yellow'});s=play(s,1,s.players[1].hand[0],'build',{naval:'yellow'});s=resolveHand(s);assert.equal(s.players[0].coins,35);assert.equal(s.players[1].coins,36);assert.equal(s.players[2].coins,3);assert.equal(s.players[3].coins,11);
});

test('simultaneous explorers split all nine islands 4/4, keep offers secret, then return unchosen cards without duplication',()=>{
 let s=hand(clean(),['1-apothecary@0','1-apothecary@1','1-altar@0']);s.players[0].fleets.green=1;s.players[1].fleets.green=1;s.players.forEach(p=>{p.wonder='halicarnassus';p.coins=20;});
 s=play(s,0,s.players[0].hand[0],'build',{naval:'green'});s=play(s,1,s.players[1].hand[0],'build',{naval:'green'});s=resolveHand(s);assert.equal(s.phase,'explore');const a=g.view(s,'a'),b=g.view(s,'b');assert.equal(a.exploration.cards.length,4);assert.equal(b.exploration.cards.length,4);assert.ok(a.exploration.cards.every(c=>!b.exploration.cards.some(x=>x.id===c.id)));assert.equal(g.view(s,'c').exploration,null);
 const aid=a.exploration.cards.find(c=>c.effect.points)?.id??a.exploration.cards[0].id;s=command(s,'a',{type:'islandPick',offerId:a.exploration.offerId,cardId:aid});assert.equal(g.view(s,'b').players[0].islands.length,0);assert.throws(()=>command(s,'b',{type:'islandPick',offerId:a.exploration.offerId,cardId:aid}));
 s=command(s,'b',{type:'islandPick',offerId:b.exploration.offerId,cardId:b.exploration.cards[0].id});while(s.phase==='ability'){const v=g.view(s,s.tasks[0].playerId);s=command(s,v.ability.playerId,{type:'ability',value:v.ability.options[0].value});}
 assert.equal(s.players[0].islands.length,1);assert.equal(s.players[1].islands.length,1);assert.equal(s.islandDecks[0].length,7);assert.equal(new Set([...s.islandDecks[0],...s.players.flatMap(p=>p.islands)]).size,9);
});

test('naval conflict resolves ties for every age without awarding duplicate last/second-place tokens',()=>{
 const players=values=>values.map((v,i)=>({id:String(i),wonder:'giza',side:'day',cards:[],stages:0,leaders:[],islands:[],fleets:{red:v,blue:0,yellow:0}}));
 for(const age of [1,2,3]){const rows=values=>navalResults(players(values),age).map(x=>x.token);assert.deepEqual(rows([0,0,0]),[0,0,0]);assert.deepEqual(rows([3,2,1]),[2*age+1,2*age-1,-age]);assert.deepEqual(rows([3,3,1]),[2*age-1,2*age-1,-age]);assert.deepEqual(rows([3,2,2,1]),[2*age+1,0,0,-age]);assert.deepEqual(rows([3,1,1]),[2*age+1,-age,-age]);assert.deepEqual(rows([3,1]),[2*age+1,-age]);}
});

test('naval opting out is private until all eligible players choose and never changes land conflicts',()=>{
 let s=hand(clean(),['1-altar@0']);s.round=7;s.players[0].islands=['island-forgotten'];s.players[0].cards=['1-barracks@0'];s.players[1].fleets.red=3;s.players[2].fleets.red=1;s=resolveHand(s);assert.equal(s.phase,'navalChoice');assert.ok(s.players[0].military.includes(1));assert.equal(g.view(s,'a').canNavalChoice,true);assert.equal(g.view(s,'b').canNavalChoice,false);s=command(s,'a',{type:'navalChoice',participate:false});assert.equal(s.age,2);assert.deepEqual(s.players[0].navalMilitary,[]);assert.deepEqual(s.players[1].navalMilitary,[3]);assert.deepEqual(s.players[2].navalMilitary,[-1]);
});

test('Siracusa stages are selected in any order and their army/sea effects are distinct',()=>{
 let s=hand(clean(),['1-altar@0']);const p=s.players[0];p.wonder='siracusa';p.cards=['1-clay@0','2-brickyard@0','1-press@0'];assert.ok(wonderQuote(s,p,false,2).plans.length);s=play(s,0,p.hand[0],'wonder',{stage:2});s=resolveHand(s);assert.deepEqual(s.players[0].builtStages,[2]);assert.equal(g.view(s,'a').players[0].shields,1);assert.equal(s.phase,'ability');s=command(s,'a',{type:'ability',value:'red'});assert.ok(wonderQuote(s,s.players[0],false,0).stage===1);
});

test('Abu Simbel mummifies an existing leader, removes its abilities and scores printed age cost as six',()=>{
 let s=hand(clean(),['1-altar@0']);const p=s.players[0];p.wonder='abu-simbel';p.side='night';p.leaders=['leader-caesar','leader-aganice'];p.cards=['2-brickyard@0','1-glass@0'];s=play(s,0,p.hand[0],'wonder');s=resolveHand(s);assert.equal(s.phase,'ability');s=command(s,'a',{type:'ability',value:'leader-caesar'});assert.equal(g.view(s,'a').players[0].shields,0);assert.equal(scores(s)[0].wonder,10);s.players[0].mummies=['leader-aganice'];assert.equal(scores(s)[0].wonder,6);
});

test('Telesilla can remove Nitocris token gained on same turn; Nero rewards land victory only; Tomyris reflects defeat',()=>{
 let s=clean();s.phase='recruit';s.players[0].leaderHand=['leader-telesilla'];s.players[1].leaderHand=['leader-nitocris'];s.players[2].leaderHand=['leader-sappho'];for(const id of ids)s=command(s,id,{type:'choose',cardId:s.players.find(p=>p.id===id).leaderHand[0],action:'build'});assert.equal(s.phase,'ability');assert.equal(s.tasks[0].playerId,'b');s=command(s,'b',{type:'ability',value:1});assert.deepEqual(s.players[1].military,[]);
 s=hand(clean(),['1-altar@0']);s.round=7;s.players[0].leaders=['leader-tomyris'];s.players[1].leaders=['leader-nero'];s.players[1].cards=['1-barracks@0'];const coins=s.players[1].coins;s=resolveHand(s);assert.ok(!s.players[0].military.includes(-1));assert.ok(s.players[1].military.includes(-1));assert.equal(s.players[1].coins,coins+3+4);
});

test('science majority, change, leader sets, treasury, navy and island scoring optimize without inflating building colors',()=>{
 const s=clean(),p=s.players[0];p.cards=['1-apothecary@0','2-dispensary@0','1-workshop@0','1-scriptorium@0'];p.leaders=['leader-aristotle','leader-enheduanna','leader-aganice'];p.islands=['island-sheltered','island-inhabited'];p.fleets.blue=6;p.fleets.red=6;p.fleets.yellow=6;p.navalMilitary=[3,5,-3];let row=scores(s)[0];assert.equal(row.green,21);assert.equal(row.islands,7);assert.equal(row.fleet,10);assert.equal(row.naval,5);assert.equal(navalStrength(p),11);assert.equal(row.leaders,0);
 p.leaders=['leader-agrippina','leader-midas'];p.coins=9;assert.equal(scores(s)[0].leaders,3);p.leaders=['leader-agrippina'];assert.equal(scores(s)[0].leaders,7);
 p.cards=['3-workers@0'];s.players[1].cards=Array.from({length:12},(_,i)=>'1-lumber@'+i);assert.equal(scores(s)[0].purple,12); // the 10-point guild cap belongs only to the excluded team variant
});

test('room host can atomically change lobby options, stale/invalid/member/in-game edits leave room untouched and clear human readiness',()=>{
 const store=new JsonStore(),sessions=new SessionService(store),a=sessions.create('A').user,b=sessions.create('B').user,events=[],service=new RoomService(store,games,{random:rng(1),notify:(...x)=>events.push(x)});let r=service.createRoom(a,{gameId:'seven-wonders',title:'扩展房间'});r=service.join(b,r.id);r=service.mutate(a,r.id,{type:'addBot',revision:r.revision});r=service.mutate(a,r.id,{type:'ready',ready:true,revision:r.revision});r=service.mutate(b,r.id,{type:'ready',ready:true,revision:r.revision});
 let old=structuredClone(store.data);assert.throws(()=>service.mutate(b,r.id,{type:'updateOptions',options:{leaders:true},revision:r.revision}),{status:403});assert.deepEqual(store.data,old);assert.throws(()=>service.mutate(a,r.id,{type:'updateOptions',options:{bad:true},revision:r.revision}));assert.deepEqual(store.data,old);
 const stale=r.revision;r=service.mutate(a,r.id,{type:'updateOptions',options:{side:'day',leaders:true,armada:true},revision:r.revision});assert.ok(events.length);assert.deepEqual(r.options,{side:'day',leaders:true,armada:true});assert.ok(r.players.filter(p=>!p.isBot).every(p=>!p.ready));assert.ok(r.players.filter(p=>p.isBot).every(p=>p.ready));assert.throws(()=>service.mutate(a,r.id,{type:'updateOptions',options:{},revision:stale}),{status:409});
 for(const u of [a,b])r=service.mutate(u,r.id,{type:'ready',ready:true,revision:r.revision});r=service.mutate(a,r.id,{type:'start',revision:r.revision});old=structuredClone(store.data);assert.equal(r.game.phase,'leaderDraft');assert.throws(()=>service.mutate(a,r.id,{type:'updateOptions',options:{},revision:r.revision}),{status:403});assert.deepEqual(store.data,old);
});

test('v1 migration preserves ongoing base hands, pending choice, discarded cards, coins and ready room; server runs migration once',t=>{
 const old=fresh({});delete old.expansions;for(const p of old.players)for(const key of ['leaders','leaderHand','draftLeaders','mummies','islands','navalMilitary','builtStages'])delete p[key];old.pending.a={cardId:old.players[0].hand[0],action:'sell',payment:{left:0,right:0,bank:0,reason:'sell'}};
 const store=new JsonStore();store.data.rooms.R={id:'R',gameId:'seven-wonders',stateVersion:1,revision:8,game:old,status:'playing',players:ids.map(id=>({id,name:id})),hostId:'a',options:{side:'day'},chat:[],matchId:'migration-test',createdAt:1};const app=createApp({store,registry:games,random:rng(1),botDelay:999999});t.after(()=>app.closeStreams());assert.equal(store.data.rooms.R.stateVersion,2);assert.equal(store.data.rooms.R.revision,9);const migrated=store.data.rooms.R.game;assert.deepEqual(migrated.pending,old.pending);assert.deepEqual(migrated.players[0].hand,old.players[0].hand);assert.equal(migrated.players[0].coins,3);assert.equal(g.view(migrated,'b').pending,null);assert.deepEqual(migrated.expansions,{leaders:false,armada:false,leaderExpert:false});assert.deepEqual(g.migrate(old,1),migrated);assert.throws(()=>g.migrate(old,99));
});

test('renderer drives leader selection, combined naval payment, sell reward, abilities, public expansion tab and island choice',async()=>{
 let s=fresh(),out=[],r;const snap=()=>({hostId:'a',players:ids.map(id=>({id,name:id==='b'?'<script>':id})),game:g.view(s,'a')});r=createSevenWondersRenderer(c=>out.push(c),()=>{});let html=r.render(snap(),{id:'a'});assert.match(html,/选择领袖/);assert.ok(!html.includes('<script>'));
 await r.handle('card',{dataset:{card:s.players[0].draftLeaders[0]}});html=r.render(snap(),{id:'a'});assert.match(html,/确认选择/);await r.handle('confirm',{});assert.equal(out.at(-1).type,'leaderPick');
 s=hand(clean(),['1-armada-construction']);s.players[0].cards=['1-lumber@0'];html=r.render(snap(),{id:'a'});await r.handle('card',{dataset:{card:s.players[0].hand[0]}});html=r.render(snap(),{id:'a'});assert.match(html,/同时建造民用船/);await r.handle('naval',{});html=r.render(snap(),{id:'a'});await r.handle('confirm',{});assert.equal(out.at(-1).naval,'blue');
 await r.handle('card',{dataset:{card:s.players[0].hand[0]}});await r.handle('mode',{dataset:{mode:'sell'}});await r.handle('sell-reward',{dataset:{fleet:'true'}});await r.handle('confirm',{});assert.equal(out.at(-1).sellFleet,true);
 await r.handle('inspect',{dataset:{player:'b'}});await r.handle('city-tab',{dataset:{tab:'expansions'}});html=r.render(snap(),{id:'a'});assert.match(html,/舰队/);assert.match(html,/领袖/);
});

test('Rome extra recruitment can spend same-turn yellow-fleet income, and boxed leaders remain available to its draw',()=>{
 let s=hand(clean(),['1-altar@0']);const p=s.players[0];Object.assign(p,{wonder:'roma',side:'night',stages:1,builtStages:[0],coins:2,leaderHand:['leader-caesar'],cards:['1-lumber@0','1-stone@0','1-glass@0','2-forum@0'],shipyard:5});p.fleets.yellow=1;
 s=play(s,0,p.hand[0],'wonder',{naval:'yellow'});s=resolveHand(s);assert.equal(s.phase,'recruitExtra');assert.equal(s.players[0].coins,4);assert.ok(g.view(s,'a').hand.find(c=>c.id==='leader-caesar').build.plans.length);s=command(s,'a',{type:'choose',cardId:'leader-caesar',action:'build'});assert.equal(s.players[0].coins,1);assert.equal(s.players[0].leaders[0],'leader-caesar');
 s=hand(clean(),['1-altar@0']);Object.assign(s.players[0],{wonder:'roma',side:'night',cards:['1-lumber@0','1-clay@0']});s.leaderDeck=['leader-sappho','leader-zenobia','leader-nefertiti','leader-cleopatra'];s=play(s,0,s.players[0].hand[0],'wonder');s=resolveHand(s);assert.equal(s.players[0].leaderHand.length,4);assert.equal(s.leaderDeck.length,0);
});

test('Berenice combines with Hatshepsut once per neighbor and once per turn; pending quotes cannot buy two Bilkis resources',()=>{
 let s=hand(clean(),['2-temple@0']);const p=s.players[0];p.wonder='alexandria';p.leaders=['leader-hatshepsut','leader-berenice'];s.players[1].wonder='rhodes';s.players[1].cards=['1-lumber@0'];s.players[2].wonder='ephesus';s.players[2].cards=['1-clay@0'];const q=buildQuote(s,p,p.hand[0]).plans.find(q=>q.left===2&&q.right===2);assert.ok(q);s=play(s,0,p.hand[0],'build',{payment:q});s=resolveHand(s);assert.equal(s.players[0].coins,29); // 30 -4 +1 +1 + one Berenice
 const a=clean().players[0];a.leaders=['leader-bilkis'];a.bankResourceUsed=true;s.players[0]=a;s.players[1].wonder='giza';s.players[2].wonder='giza';s.players[1].cards=[];s.players[2].cards=[];assert.equal(paymentPlans(s,a,{resources:'g',coins:0}).length,0);
});

test('two boarding cards never duplicate a military conflict between the same pair in an age',()=>{
 let s=clean();s.players.push({...structuredClone(s.players[2]),id:'d'});s.players.forEach((p,i)=>{p.hand=['1-altar@'+i,'1-theater@'+i];p.cards=[];});s.players[0].hand[0]='1-armada-pontoon';s.players[0].cards=['3-arsenal@0','1-press@0'];s.players[2].hand[0]='2-armada-ballista';s.players[2].cards=['1-lumber@0','1-glass@0','1-loom@0'];s.round=7;
 for(const [i,p] of [...s.players].entries())s=command(s,p.id,{type:'choose',cardId:p.hand[0],action:i===0||i===2?'build':'sell'});assert.equal(s.boardings.length,1);assert.equal(s.players[0].military.filter(v=>v>0).length,3);
});

test('renderer hides naval construction at track cap and ignores a stale toggle without rendering a seventh-step cost',async()=>{
 const s=hand(clean(),['1-armada-construction']);s.players[0].fleets.blue=6;let r=createSevenWondersRenderer(()=>{},()=>{});const snapshot={players:ids.map(id=>({id,name:id})),game:g.view(s,'a')};r.render(snapshot,{id:'a'});await r.handle('card',{dataset:{card:s.players[0].hand[0]}});let html=r.render(snapshot,{id:'a'});assert.ok(!html.includes('同时建造民用船'));await r.handle('naval',{});html=r.render(snapshot,{id:'a'});assert.ok(html.includes('建造建筑'));
});

test('all player counts and expansion combinations finish through public-view bots, survive JSON and conserve island/leader identities',()=>{
 for(const options of [{leaders:true},{armada:true},{leaders:true,armada:true},{leaders:true,leaderExpert:true,armada:true}])for(let n=3;n<=7;n++){
  const random=rng(n*53),playerIds=Array.from({length:n},(_,i)=>String(i));let s=g.create(playerIds,{...options,side:n%2?'night':'day'},random),steps=0;
  while(!g.isFinished(s)&&steps++<200){let progress=false;for(const p of s.players){const cmd=g.bot.decide(g.view(s,p.id),p.id);if(cmd){s=g.apply(s,p.id,cmd,{random});progress=true;if(g.isFinished(s))break;}}assert.ok(progress,`${JSON.stringify(options)} ${n} stuck ${s.phase}`);assert.ok(s.players.every(p=>p.coins>=0));s=JSON.parse(JSON.stringify(s));}
  assert.ok(g.isFinished(s));assert.equal(s.ageResults.length,3);assert.equal(g.result(s).players.length,n);if(options.leaders){const leaders=[...s.leaderDeck,...s.players.flatMap(p=>[...p.leaders,...p.leaderHand,...p.mummies,...p.buried.filter(id=>card(id).color==='white')])];assert.equal(leaders.length,options.leaderExpert?49:34);assert.equal(new Set(leaders).size,leaders.length);}if(options.armada){const islands=s.islandDecks.flat().concat(s.players.flatMap(p=>p.islands));assert.equal(islands.length,27);assert.equal(new Set(islands).size,27);assert.ok(s.ageResults.every(r=>r.naval));}
 }
});

