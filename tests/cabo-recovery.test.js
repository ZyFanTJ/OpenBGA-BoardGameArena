import test from 'node:test';
import assert from 'node:assert/strict';
import {createTableAnimator} from '../apps/web/games/cabo-motion.js';
import {cabo} from '../packages/games/cabo/index.js';
import {RoomService} from '../packages/platform/rooms.js';
import {JsonStore} from '../packages/platform/store.js';
import {games} from '../packages/games/registry.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('CABO resync replaces an in-flight scene at the same revision and obsolete cleanup cannot unlock the new scene',async()=>{
 const originals={window:globalThis.window,document:globalThis.document,matchMedia:globalThis.matchMedia},gates=[],draws=[];
 function node(){const classes=new Set();return {dataset:{motionKey:'hand:a:0',value:'',},style:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},getBoundingClientRect:()=>({x:0,y:0,width:60,height:90}),querySelector:()=>null,setAttribute(){},append(){},remove(){},animate(){let finish;const finished=new Promise(resolve=>finish=resolve);gates.push(finish);return {finished,cancel:finish};}};}
 const target={...node(),inert:false,contains:()=>false,setAttribute(){},removeAttribute(){},querySelectorAll(){return this.card?[this.card]:[];}};
 globalThis.window=new EventTarget();globalThis.document=Object.assign(new EventTarget(),{hidden:false,body:{append(){}},createElement:node});globalThis.matchMedia=()=>Object.assign(new EventTarget(),{matches:false});
 const animator=createTableAnimator(snapshot=>{draws.push(snapshot.revision);target.card=node();target.card.dataset.value=String(snapshot.game.value);return 'table:'+snapshot.revision;});
 const snapshot=(revision,value,motion=null)=>({revision,players:[{id:'a',name:'A'}],game:{value,phase:'setup',motion}});
 const look={kind:'look',actorId:'a',targets:[{playerId:'a',slot:0}]};
 try{
  animator.update(target,snapshot(1,0),{});
  animator.update(target,snapshot(2,7,look),{});
  assert.equal(animator.busy,true);assert.equal(target.inert,true);assert.equal(target.card.classList.contains('motion-hidden'),true);
  animator.update(target,snapshot(3,8,look),{});
  animator.update(target,snapshot(3,8),{},{resetAnimations:true});
  assert.equal(animator.busy,false);assert.equal(target.inert,false);assert.equal(target.innerHTML,'table:3');assert.equal(target.card.classList.contains('motion-hidden'),false);
  animator.update(target,snapshot(4,9,look),{});
  await flush();assert.equal(animator.busy,true);assert.equal(target.inert,true,'obsolete scene must not unlock the current animation');
  for(let i=0;i<5;i++){gates.splice(0).forEach(finish=>finish());await flush();}
  assert.equal(animator.busy,false);assert.equal(target.inert,false);assert.equal(target.innerHTML,'table:4');assert.deepEqual(draws,[1,2,3,4]);
 }finally{animator.dispose();Object.assign(globalThis,originals);}
});

test('CABO independent setup choices survive another player revision, but cannot repeat or cross phases or matches',()=>{
 const store=new JsonStore(),rooms=new RoomService(store,games,{random:()=>.4}),a={id:'a',name:'A'},b={id:'b',name:'B'};
 const id=rooms.createRoom(a,{gameId:'cabo',title:'Setup race',turnSeconds:0}).id;rooms.join(b,id);
 const act=(user,input)=>rooms.mutate(user,id,{revision:store.data.rooms[id].revision,...input});
 act(a,{type:'ready',ready:true});act(b,{type:'ready',ready:true});const start=act(a,{type:'start'});
 act(b,{type:'game',command:{type:'look',slots:[0,1]}});
 const mine=act(a,{type:'game',revision:start.revision,matchId:start.matchId,submissionKey:start.submissionKey,command:{type:'look',slots:[0,1]}});
 assert.deepEqual(mine.game.setup.slots,[0,1]);
 assert.throws(()=>act(a,{type:'game',revision:start.revision,matchId:start.matchId,submissionKey:start.submissionKey,command:{type:'look',slots:[0,1]}}),/房间已更新/);
 act(b,{type:'game',command:{type:'confirm'}});
 const done=act(a,{type:'game',revision:mine.revision,matchId:mine.matchId,submissionKey:mine.submissionKey,command:{type:'confirm'}});
 assert.equal(done.game.phase,'turn');assert.equal(done.submissionKey,null);
 assert.equal(cabo.submissionKey(store.data.rooms[id].game,a.id),null);
 assert.throws(()=>act(a,{type:'game',revision:start.revision,matchId:'old-match',submissionKey:start.submissionKey,command:{type:'draw',source:'deck'}}),/房间已更新/);
});

