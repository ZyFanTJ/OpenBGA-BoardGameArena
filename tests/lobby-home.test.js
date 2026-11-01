import test from 'node:test';
import assert from 'node:assert/strict';
import {lobbyTables, lobbyRecent} from '../apps/web/lobby.js';

const games = [{id:'cabo',title:'CABO'},{id:'uno',title:'UNO'}];
const room = {id:'ROOM0001',gameId:'cabo',title:'一起玩',host:'小鹿',status:'lobby',count:1,maxPlayers:4};

test('homepage offers AI when no waiting public table has a free seat', () => {
  for (const rooms of [[],[{...room,count:4}],[{...room,status:'playing'}],[{...room,status:'finished'}],[{...room,gameId:'unavailable'}]]) {
    const html = lobbyTables(rooms,games,{});
    assert.match(html,/data-action="open-practice"/);
    assert.doesNotMatch(html,/data-action="join-public"/);
  }
});

test('homepage shows only joinable tables, limits the shelf and escapes user text', () => {
  const rooms = [{...room,status:'playing'},...Array.from({length:4},(_,i)=>({...room,id:`ROOM000${i}`,title:'<script>bad</script>',host:'<img>'}))];
  const html = lobbyTables(rooms,games,{});
  assert.equal((html.match(/data-action="join-public"/g)??[]).length,3);
  assert.doesNotMatch(html,/data-action="open-practice"|<script>|<img>/);
  assert.match(html,/&lt;script&gt;/);
});

test('recent games deduplicate actual records and omit unavailable games', () => {
  const html = lobbyRecent([{gameId:'gone'},{gameId:'uno'},{gameId:'uno'},{gameId:'cabo'}],games);
  assert.equal((html.match(/data-game-id="uno"/g)??[]).length,1);
  assert.ok(html.indexOf('UNO')<html.indexOf('CABO'));
  assert.match(lobbyRecent([],games),/data-action="help"/);
});
