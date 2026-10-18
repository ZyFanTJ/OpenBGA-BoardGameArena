import test from 'node:test';
import assert from 'node:assert/strict';
import { marrakech } from '../packages/games/marrakech/index.js';
import { DIE, neighbors, placements, region, step, walk } from '../packages/games/marrakech/board.js';
import { JsonStore } from '../packages/platform/store.js';
import { RoomService } from '../packages/platform/rooms.js';
import { games } from '../packages/games/registry.js';
import { createMarrakechRenderer } from '../apps/web/games/marrakech/index.js';

const fixed = () => 0;
const create = (n = 3) => marrakech.create(['a','b','c','d'].slice(0,n), {}, fixed);
const act = (s, command, random = fixed) => marrakech.apply(s, s.players[s.turn].id, command, { random });
const carpet = (color, ownerId, rugId) => ({ color, ownerId, rugId, half: 0, vertical: false });
function frozen(value) { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; }

test('Marrakech setup matches each player count and hides shuffled stocks in every view', () => {
  for (const n of [2,3,4]) {
    const s = create(n);
    assert.equal(s.board.length,49); assert.deepEqual(s.pawn,{x:3,y:3,direction:0});
    assert.ok(s.players.every(p=>p.coins===30 && p.rugs.length===(n===2?24:n===3?15:12)));
    if (n===2) for (const p of s.players) for (const c of p.colors) assert.equal(p.rugs.filter(r=>r===c).length,12);
    for (const p of s.players) {
      const view=marrakech.view(s,p.id);
      assert.ok(view.players.every(x=>!('rugs' in x)));
      assert.equal(view.legal.directions.length,p.id===s.players[s.turn].id?3:0);
      assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
    }
  }
  assert.throws(()=>marrakech.create(['a','a'],{},fixed));
  assert.throws(()=>marrakech.create(['a','b'],{variant:true},fixed));
});

test('special die is weighted and direction is locked before the roll', () => {
  assert.deepEqual(DIE,[1,2,2,3,3,4]);
  for (let i=0;i<6;i++) assert.equal(act(create(),{type:'roll',direction:0},()=> (i+.1)/6).lastEvent.die,DIE[i]);
  const s=frozen(create());
  assert.throws(()=>act(s,{type:'roll',direction:2}));
  assert.throws(()=>act(s,{type:'roll',direction:'0'}));
  assert.throws(()=>marrakech.apply(s,'b',{type:'roll',direction:0},{random:fixed}),{status:403});
  const moved=act(s,{type:'roll',direction:1});
  assert.deepEqual(moved.pawn,{x:4,y:3,direction:1}); assert.equal(s.pawn.x,3);
  assert.throws(()=>act(moved,{type:'roll',direction:0}));
  assert.throws(()=>act(s,{type:'place',cells:[0,1]}));
});

test('every edge follows printed pairs; corner re-entry counts exactly once', () => {
  const fixtures = [
    [{x:1,y:0,direction:0},{x:2,y:0,direction:2}],
    [{x:6,y:0,direction:0},{x:5,y:0,direction:2}],
    [{x:0,y:3,direction:3},{x:0,y:4,direction:1}],
    [{x:2,y:6,direction:2},{x:3,y:6,direction:0}],
    [{x:6,y:4,direction:1},{x:6,y:5,direction:3}],
    [{x:0,y:0,direction:0},{x:0,y:0,direction:1}],
    [{x:0,y:0,direction:3},{x:0,y:0,direction:2}],
    [{x:6,y:6,direction:1},{x:6,y:6,direction:0}],
    [{x:6,y:6,direction:2},{x:6,y:6,direction:3}],
  ];
  for (const [from,to] of fixtures) assert.deepEqual(walk(from,1).pawn,to);
  assert.deepEqual(walk({x:1,y:1,direction:0},3).pawn,{x:2,y:1,direction:2});
  assert.deepEqual(walk({x:0,y:0,direction:0},2).pawn,{x:1,y:0,direction:1});
  for(let x=0;x<7;x++) for(let y=0;y<7;y++) for(let d=0;d<4;d++) {
    const to=step({x,y,direction:d}); assert.ok(to.x>=0&&to.x<7&&to.y>=0&&to.y<7);
    const back=step({...to,direction:(to.direction+2)%4});
    assert.deepEqual([back.x,back.y,back.direction],[x,y,(d+2)%4]);
  }
});

test('payments use visible same-color edge-connected cells, not diagonals or ownership alone', () => {
  const s=create(2);
  for (const i of [17,18,25]) s.board[i]=carpet(2,'b',i);
  s.board[10]=carpet(3,'b',50); s.board[9]=carpet(2,'b',51); // different color / diagonal
  assert.deepEqual(new Set(region(s.board,17)),new Set([17,18,25]));
  const moved=act(s,{type:'roll',direction:0});
  assert.equal(moved.players[0].coins,27); assert.equal(moved.players[1].coins,33);
  assert.equal(moved.lastEvent.payment.due,3);
  s.board[17]=carpet(0,'a',60); assert.equal(act(s,{type:'roll',direction:0}).lastEvent.payment,null);
});

test('exact payment survives; insufficient payment eliminates and neutral rugs stop charging', () => {
  const s=create(); s.players[0].coins=2;
  s.board[17]=carpet(1,'b',1); s.board[18]=carpet(1,'b',2);
  let result=act(s,{type:'roll',direction:0});
  assert.equal(result.players[0].coins,0); assert.equal(result.players[0].eliminated,false); assert.equal(result.phase,'place');
  s.board[25]=carpet(1,'b',3); result=act(s,{type:'roll',direction:0});
  assert.equal(result.players[0].eliminated,true); assert.deepEqual(result.players[0].rugs,[]);
  assert.equal(result.players[1].coins,32); assert.equal(result.turn,1); assert.equal(result.phase,'orient');
  result.board[10]=carpet(0,'a',4);
  assert.equal(act(result,{type:'roll',direction:0}).lastEvent.payment,null);
  const two=create(2); two.players[0].coins=0; two.board[17]=carpet(2,'b',1);
  const end=act(two,{type:'roll',direction:0}); assert.equal(end.phase,'finished'); assert.deepEqual(end.winners,['b']);
});

test('rug placement enforces boundaries, adjacency, occupancy and identity of the old rug', () => {
  const s=act(create(),{type:'roll',direction:0}); // pawn D3 (17)
  const invalid=[[17,18],[0,1],[16,18],[6,7],[16,16],[-1,0],[16.5,17.5],[16,23,24]];
  for(const cells of invalid) assert.throws(()=>act(s,{type:'place',cells}));
  s.board[23]=carpet(0,'a',5);s.board[24]=carpet(0,'a',5);
  assert.throws(()=>act(s,{type:'place',cells:[23,24]})); // own complete rug also protected
  s.board[24]=carpet(0,'a',6);
  const before=JSON.stringify(s), placed=act(frozen(s),{type:'place',cells:[24,23]});
  assert.equal(JSON.stringify(s),before); assert.equal(placed.players[0].rugs.length,14);
  assert.equal(placed.board[23].rugId,placed.board[24].rugId); assert.equal(placed.board[23].half,0); assert.equal(placed.board[24].half,1);
  assert.equal(placed.turn,1);
});

test('end score counts visible halves and breaks ties by money, then shares victory', () => {
  const s=act(create(),{type:'roll',direction:0});
  s.players.forEach(p=>p.rugs=[]);s.players[0].rugs=[0];
  s.players[0].coins=28; // 28 + new two halves = 30; b has 30 money
  let result=act(s,{type:'place',cells:[23,24]});
  assert.deepEqual(result.winners,['b','c']);
  s.players[1].coins=29;s.players[2].coins=29;
  result=act(s,{type:'place',cells:[23,24]});assert.deepEqual(result.winners,['a']);
  assert.throws(()=>act(result,{type:'roll',direction:0}));
});

test('AI completes 2/3/4-player games using only redacted views, preserving coins and immutability', () => {
  for (let n=2;n<=4;n++) for(let seed=1;seed<=12;seed++) {
    let counter=seed; const rng=()=>((counter=(counter*1664525+1013904223)>>>0)/4294967296);
    let s=marrakech.create(['a','b','c','d'].slice(0,n),{},rng), actions=0;
    while(!marrakech.isFinished(s) && actions++<130) {
      const id=s.players[s.turn].id, v=marrakech.view(s,id), c=marrakech.bot.decide(v,id,{});
      assert.ok(c); const old=JSON.stringify(s); const result=marrakech.apply(frozen(s),id,c,{random:rng});
      assert.equal(JSON.stringify(s),old);s=result;
      assert.equal(s.players.reduce((sum,p)=>sum+p.coins,0),n*30);
      assert.ok(s.players.every(p=>p.coins>=0));
      assert.equal(s.board.length,49);
    }
    assert.equal(s.phase,'finished');assert.ok(s.winners.length>0);
  }
});

test('Marrakech plugs into room revision checks, bots, leave takeover and rematch', () => {
  const service=new RoomService(new JsonStore(),games,{random:fixed}), a={id:'a',name:'A'}, b={id:'b',name:'B'};
  let r=service.createRoom(a,{gameId:'marrakech',title:'市集'});r=service.join(b,r.id);
  const action=(u,input)=>r=service.mutate(u,r.id,{...input,revision:r.revision});
  action(a,{type:'ready',ready:true});action(b,{type:'ready',ready:true});action(a,{type:'start'});
  assert.equal(r.game.phase,'orient');assert.equal(r.supportsBots,true);
  const stale=r.revision;action(a,{type:'game',command:{type:'roll',direction:0}});
  assert.throws(()=>service.mutate(a,r.id,{type:'game',command:{type:'place',cells:r.game.legal.placements[0]},revision:stale}),{status:409});
  const id=r.id;action(a,{type:'leave'});r=service.snapshot(id,b);
  assert.equal(r.hostId,'b');assert.equal(r.players.find(p=>p.id==='a').isBot,true);
  while(r.status==='playing') {
    const state=service.room(id), player=state.players.find(p=>p.id===r.game.turnId), view=service.snapshot(id,player,undefined,!!player.isBot);
    r=service.mutate(player,id,{type:'game',command:marrakech.bot.decide(view.game,player.id,{}),revision:r.revision},{bot:!!player.isBot});
  }
  r=service.snapshot(id,b);action(b,{type:'rematch'});assert.equal(r.game,null);assert.equal(r.players.length,1);
});

test('renderer escapes names and produces game-specific commands without rules in the shell', async () => {
  let state=create(2);let last;
  const renderer=createMarrakechRenderer(async c=>{last=c;state=act(state,c);},()=>{});
  const render=()=>renderer.render({game:marrakech.view(state,'a'),players:[{id:'a',name:'<Alice>'},{id:'b',name:'Bob'}],hostId:'a'},{id:'a'});
  assert.match(render(),/&lt;Alice&gt;/);
  await renderer.handle('direction',{dataset:{direction:'1'}});await renderer.handle('roll');
  assert.deepEqual(last,{type:'roll',direction:1});render();
  const cells=marrakech.view(state,'a').legal.placements[0];
  for(const cell of cells) await renderer.handle('cell',{dataset:{cell:String(cell)}});
  await renderer.handle('place');assert.deepEqual(last,{type:'place',cells});
});
