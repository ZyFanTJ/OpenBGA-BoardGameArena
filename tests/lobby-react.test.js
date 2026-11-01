import test from 'node:test';
import assert from 'node:assert/strict';
import {createLobbyStore,catalogPage,availableTables} from '../apps/web/lobby/state.js';
import {createLobbySurface} from '../apps/web/lobby-surface.js';

test('lobby catalog clamps pagination after filtering and never adds disabled games to tables',()=>{
 const games=Array.from({length:15},(_,i)=>({id:`game-${i}`,title:`桌游 ${i}`,category:i%2?'卡牌游戏':'策略对战'}));
 assert.deepEqual(catalogPage(games,{page:99,pageSize:6}).items.map(g=>g.id),['game-12','game-13','game-14']);
 const filtered=catalogPage(games,{category:'卡牌游戏',page:3,pageSize:6});assert.equal(filtered.pages,2);assert.equal(filtered.items.length,1);
 assert.equal(catalogPage(games,{query:'not found'}).count,0);
 const room={id:'A',gameId:'game-0',status:'lobby',count:1,maxPlayers:4};
 assert.equal(availableTables([room,room],games).length,1);
 assert.equal(availableTables([room],[{...games[0],enabled:false}]).length,0);
 assert.equal(availableTables([{...room,count:4}],games).length,0);
});
test('public data updates retain catalog input, skip equal updates, and dispose subscriptions',()=>{
 const store=createLobbyStore({games:[]});let changes=0;store.subscribe(()=>changes++);
 store.patch({query:'UNO',category:'卡牌游戏',page:1});const selected=store.getSnapshot();
 store.patch({query:'UNO'});assert.equal(store.getSnapshot(),selected);assert.equal(changes,1);
 store.patch({friends:[{id:'friend'}]});assert.equal(store.getSnapshot().query,'UNO');assert.equal(store.getSnapshot().page,1);
 store.dispose();store.patch({query:''});assert.equal(changes,2);assert.equal(store.getSnapshot().query,'UNO');
});
test('leaving before the React bundle loads prevents mounting into another page',async()=>{
 let resolve,mounts=0;const element={isConnected:true},root={querySelector:()=>element};
 const surface=createLobbySurface(root,{games:[]},{loader:()=>new Promise(done=>resolve=done)});
 surface.dispose();resolve({mountLobby(){mounts++;}});await surface.ready;assert.equal(mounts,0);
});
test('React lobby unmounts and disconnects on disposal, late updates cannot revive it',async()=>{
 let mounts=0,unmounts=0;const element={isConnected:true},root={querySelector:()=>element};
 const surface=createLobbySurface(root,{games:[]},{loader:async()=>({mountLobby(){mounts++;return {dispose(){unmounts++;}};}})});
 await surface.ready;surface.dispose();surface.updateRooms([]);assert.equal(mounts,1);assert.equal(unmounts,1);
});
