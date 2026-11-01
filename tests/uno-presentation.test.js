import test from 'node:test';
import assert from 'node:assert/strict';
import { uno } from '../packages/games/uno/index.js';
import { makeDeck } from '../packages/games/uno/cards.js';
import { createUnoRenderer } from '../apps/web/games/uno/index.js';
import { cardArt,cardLabel } from '../apps/web/games/uno/art.js';
function fixture(){
  const s=uno.create(['a','b','c'],{},()=>0.42);s.turn=0;s.phase='turn';s.color='red';s.discard=[{id:'top',color:'red',value:1}];
  s.players[0].hand=[{id:'wild',color:null,value:'wild4'},{id:'red',color:'red',value:7}];s.players[1].hand=[{id:'secret-other',color:'blue',value:4}];
  return s;
}
const room=s=>({game:uno.view(s,'a'),players:[{id:'a',name:'<img src=x onerror=alert(1)>'},{id:'b',name:'小月'},{id:'c',name:'同桌'}],hostId:'a'});
test('UNO renderer escapes player names and only private hand contains card IDs',()=>{
  const html=createUnoRenderer(()=>{},()=>{}).render(room(fixture()),{id:'a'});
  assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);assert.doesNotMatch(html,/secret-other/);
  assert.match(html,/当前颜色/);assert.match(html,/你的手牌/);assert.match(html,/手牌横向滚动/);assert.doesNotMatch(html,/style="/);
});
test('wild color selection is local, sends a single complete command, and warns about illegal +4',async()=>{
  const commands=[],ui=createUnoRenderer(c=>commands.push(c),()=>{}),snapshot=room(fixture());ui.render(snapshot,{id:'a'});
  await ui.handle('card',{dataset:{cardId:'wild'}});assert.equal(commands.length,0);
  const html=ui.render(snapshot,{id:'a'});assert.match(html,/选择颜色并出牌/);assert.match(html,/可能被质疑/);
  await ui.handle('color',{dataset:{color:'blue'}});assert.deepEqual(commands,[{type:'play',cardId:'wild',color:'blue',uno:true}]);
});
test('challenge evidence remains readable across bot updates, can be dismissed and clears next round',async()=>{
  const s=fixture();s.evidence={viewerId:'a',actorId:'b',illegal:true,previousColor:'blue',hand:[{id:'proof',color:'blue',value:9}]};
  const ui=createUnoRenderer(()=>{},()=>{});let html=ui.render(room(s),{id:'a'});assert.match(html,/质疑成功/);
  s.evidence=null;s.sequence++;html=ui.render(room(s),{id:'a'});assert.match(html,/质疑成功/);
  await ui.handle('evidence-close',{});html=ui.render(room(s),{id:'a'});assert.doesNotMatch(html,/质疑证据，仅你可见/);
  s.round++;html=ui.render(room(s),{id:'a'});assert.doesNotMatch(html,/质疑证据，仅你可见/);
});
test('every card has vector art and a readable accessible name',()=>{
  for(const c of makeDeck()){assert.match(cardArt(c),/^<svg/);assert.ok(cardLabel(c).length);}
  assert.match(cardArt(null),/UNO/);assert.match(cardArt({color:'red',value:6}),/underline/);
});
test('match details and guide can be opened independently without sending game commands',async()=>{
  const commands=[],ui=createUnoRenderer(c=>commands.push(c),()=>{}),snapshot={...room(fixture()),title:'朋友的周末牌桌'};
  ui.render(snapshot,{id:'a'});
  await ui.handle('info',{});
  let html=ui.render(snapshot,{id:'a'});
  assert.match(html,/aria-label="牌局信息"/);assert.match(html,/朋友的周末牌桌/);assert.match(html,/uno-standings/);
  await ui.handle('guide',{});html=ui.render(snapshot,{id:'a'});
  assert.match(html,/UNO 玩法手卡/);assert.doesNotMatch(html,/uno-standings/);
  await ui.handle('guide',{});html=ui.render(snapshot,{id:'a'});
  assert.doesNotMatch(html,/uno-overlay/);assert.deepEqual(commands,[]);
});
