import test from 'node:test';
import assert from 'node:assert/strict';
import { canJoinRoom, filterRooms, roomCard, roomBrowserHtml } from '../apps/web/room-browser.js';
import { lobbyHtml } from '../apps/web/lobby.js';

const games = [
  {id:'cabo',title:'CABO',minPlayers:2,maxPlayers:4},
  {id:'seven-wonders',title:'七大奇迹',minPlayers:3,maxPlayers:7},
];
const rooms = [
  {id:'ABCD1234',title:'月下记忆局',host:'阿星',gameId:'cabo',status:'lobby',count:1,maxPlayers:4},
  {id:'WXYZ5678',title:'文明之夜',host:'月见',gameId:'seven-wonders',status:'lobby',count:2,maxPlayers:7},
  {id:'FULL1234',title:'满员桌',host:'阿星',gameId:'cabo',status:'lobby',count:4,maxPlayers:4},
  {id:'PLAY1234',title:'对战中',host:'月见',gameId:'cabo',status:'playing',count:2,maxPlayers:4},
  {id:'DONE1234',title:'结算桌',host:'阿星',gameId:'cabo',status:'finished',count:2,maxPlayers:4},
];
test('room filters combine availability, game, case-insensitive name/code/host/title and multiple search terms', () => {
  const original = structuredClone(rooms);
  assert.deepEqual(filterRooms([...rooms.slice(2),...rooms.slice(0,2)],games).map(r=>r.id),rooms.map(r=>r.id));
  assert.deepEqual(filterRooms(rooms,games,{status:'joinable'}).map(r=>r.id),['ABCD1234','WXYZ5678']);
  assert.equal(filterRooms(rooms,games,{query:'  #abcd1234  '})[0].id,'ABCD1234');
  assert.equal(filterRooms(rooms,games,{query:'月见 七大奇迹',gameId:'seven-wonders'})[0].id,'WXYZ5678');
  assert.equal(filterRooms(rooms,games,{query:'月下 CABO',gameId:'seven-wonders'}).length,0);
  assert.equal(filterRooms(rooms,games,{status:'all'}).length,5);
  assert.equal(filterRooms(rooms,games,{status:'playing'})[0].id,'PLAY1234');
  assert.equal(filterRooms(rooms,games,{status:'all',query:'阿星'}).length,3);
  assert.deepEqual(rooms,original);
});
test('full, active and finished rooms have disabled join actions and unambiguous states', () => {
  for (const room of rooms) {
    const html = roomCard(room,games,{});
    assert.equal(canJoinRoom(room),['ABCD1234','WXYZ5678'].includes(room.id));
    assert.equal(/data-action="join-public"[^>]* disabled/.test(html),!canJoinRoom(room));
  }
  assert.match(roomCard(rooms[2],games,{}),/已满/);
  assert.match(roomCard(rooms[3],games,{}),/进行中/);
  assert.match(roomCard(rooms[4],games,{}),/已结束/);
});
test('directory cards escape room names, host names and attributes', () => {
  const html = roomCard({...rooms[0],id:'"onclick="evil',title:'<img src=x onerror=evil()>',host:'<script>evil()</script>'},games,{});
  assert.ok(!html.includes('<script>') && !html.includes('<img src=x'));
  assert.match(html,/&lt;img/);assert.match(html,/&quot;onclick/);
});
test('room discovery belongs to my room and both surfaces contain exactly one create/join form', () => {
  const home = lobbyHtml(undefined,games,{},rooms), directory = roomBrowserHtml(undefined,games,{});
  assert.ok(!home.includes('id="room-directory"') && !home.includes('id="public-rooms"'));
  assert.ok(directory.includes('id="room-search"') && directory.includes('id="room-game"'));
  for (const html of [home,directory]) {
    assert.equal((html.match(/id="join-panel"/g)??[]).length,1);
    assert.equal((html.match(/id="join"/g)??[]).length,1);
    assert.equal((html.match(/id="create-room-dialog"/g)??[]).length,1);
  }
});
