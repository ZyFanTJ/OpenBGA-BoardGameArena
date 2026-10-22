import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalog} from '../apps/web/catalog.js';

test('responsive catalog shows multiple mobile rows and keeps filtering and paging correct after resizing',t=>{
 const previousStyle=globalThis.getComputedStyle,previousObserver=globalThis.ResizeObserver;let resize,disconnected=false,rows=3,columns=2,query='',category='全部';
 t.after(()=>{globalThis.getComputedStyle=previousStyle;globalThis.ResizeObserver=previousObserver;});
 const cards=Array.from({length:12},(_,i)=>({hidden:true,dataset:{gameSearch:i===5?'uno':'game'+i,category:i<6?'卡牌游戏':'策略对战'}}));
 const buttons={'-1':{},'1':{}},output={},pager={querySelector:selector=>selector==='output'?output:buttons[selector.includes('-1')?'-1':'1']},empty={};
 const grid={querySelectorAll:()=>cards};
 const root={querySelector:selector=>selector==='.moon-game-grid'?grid:selector==='.catalog-pagination'?pager:selector==='.catalog-no-results'?empty:selector==='#lobby-search'?{value:query}:{dataset:{filter:category}}};
 globalThis.getComputedStyle=()=>({gridTemplateColumns:Array(columns).fill('170px').join(' '),getPropertyValue:()=>String(rows)});
 globalThis.ResizeObserver=class{constructor(callback){resize=callback;}observe(){}disconnect(){disconnected=true;}};
 const catalog=createCatalog(root),visible=()=>cards.filter(c=>!c.hidden);
 assert.equal(visible().length,6);assert.equal(output.textContent,'1 / 2');assert.equal(buttons['-1'].disabled,true);
 catalog.page(1);assert.deepEqual(visible(),cards.slice(6));
 query='uno';catalog.filter();assert.deepEqual(visible(),[cards[5]]);assert.equal(pager.hidden,true);
 query='';category='卡牌游戏';catalog.filter();assert.equal(visible().length,6);
 rows=1;columns=4;resize();assert.equal(visible().length,4);assert.equal(output.textContent,'1 / 2');
 catalog.page(1);assert.equal(visible().length,2);
 rows=3;columns=2;resize();assert.equal(visible().length,6);assert.equal(output.textContent,'1 / 1');
 catalog.dispose();assert.equal(disconnected,true);
});
