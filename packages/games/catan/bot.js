const R=['wood','brick','wool','grain','ore'];
const costs={city:{grain:2,ore:3},settlement:{wood:1,brick:1,wool:1,grain:1},road:{wood:1,brick:1},development:{wool:1,grain:1,ore:1}};
const empty=()=>Object.fromEntries(R.map(r=>[r,0]));
export function decide(v,id){
 if(v.phase==='finished')return null;
 if(v.discard[id]){const hand={...v.hand},cards=empty();for(let i=0;i<v.discard[id];i++){const r=[...R].sort((a,b)=>hand[b]-hand[a])[0];hand[r]--;cards[r]++;}return {type:'discard',cards};}
 if(v.offer&&v.offer.from!==id&&(v.offer.from===v.turnId||v.turnId===id)){
   const o=v.offer,canPay=R.every(r=>v.hand[r]>=o.want[r]),received=R.reduce((n,r)=>n+o.give[r],0),paid=R.reduce((n,r)=>n+o.want[r],0);
   if(canPay&&received>=paid&&R.some(r=>o.give[r]&&v.hand[r]<2))return {type:'accept'};
 }
 if(v.turnId!==id)return null;
 const l=v.legal;
 const rankVertex=i=>v.board.vertices[i].tiles.reduce((n,j)=>n+(v.board.tiles[j].number?6-Math.abs(7-v.board.tiles[j].number):0),0);
 for(const kind of ['city','settlement'])if(l[kind].length)return {type:'build',kind,at:[...l[kind]].sort((a,b)=>rankVertex(b)-rankVertex(a))[0]};
 if(v.phase==='robber'){const tiles=v.board.tiles.filter(t=>t.id!==v.robber);tiles.sort((a,b)=>{const rank=t=>t.vertices.reduce((n,i)=>n+(v.board.vertices[i].owner?(v.board.vertices[i].owner===id?-3:2):0),0)+(t.number?6-Math.abs(7-t.number):0)*.1;return rank(b)-rank(a);});return {type:'robber',tile:tiles[0].id};}
 if(v.phase==='steal')return {type:'steal',target:l.victims[0]};
 if(l.play.includes('knight'))return {type:'play',card:'knight'};
 if(l.roll)return {type:'roll'};
 if(l.road.length&&(v.phase!=='action'||v.players.find(p=>p.id===id).pieces.road<12)){
   const rank=ei=>Math.max(...v.board.edges[ei].ends.map(i=>rankVertex(i)+(v.board.vertices[i].edges.some(j=>v.board.edges[j].ends.some(k=>v.board.vertices[k].owner))?0:12)));
   return {type:'build',kind:'road',at:[...l.road].sort((a,b)=>rank(b)-rank(a))[0]};
 }
 if(l.buy)return {type:'buy'};
 if(l.play.includes('roads'))return {type:'play',card:'roads'};
 if(l.play.includes('monopoly'))return {type:'play',card:'monopoly',resource:R[v.turnNumber%5]};
 if(l.play.includes('plenty')){const cards=empty();for(let i=0;i<2;i++){const r=[...R].filter(r=>v.bank[r]>cards[r]).sort((a,b)=>v.hand[a]+cards[a]-v.hand[b]-cards[b])[0];if(r)cards[r]++;}return {type:'play',card:'plenty',cards};}
 if(v.phase==='action'){
   const own=v.players.find(p=>p.id===id),goals=[...(own.pieces.settlement?['city']:[]),...(own.pieces.settlement<5?['settlement']:[]),'development'];
   for(const kind of goals){const cost=costs[kind],need=R.find(r=>v.hand[r]<(cost[r]??0)&&v.bank[r]);const give=R.find(r=>v.hand[r]-(cost[r]??0)>=v.rates[r]);if(need&&give)return {type:'bank',give,want:need};}
   return {type:'end'};
 }
 return null;
}
