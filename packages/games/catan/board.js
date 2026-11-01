export const resources = ['wood','brick','wool','grain','ore'];
export const empty = (n=0) => Object.fromEntries(resources.map(r=>[r,n]));
export function shuffle(items, random) { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
export function makeBoard(random) {
  const types=shuffle(['desert',...resources.flatMap(r=>Array(r==='brick'||r==='ore'?3:4).fill(r))],random);
  const numbers=[5,2,6,3,8,10,9,12,11,4,8,10,9,4,5,6,3,11];
  const vertices=[],edges=[],tiles=[],vm=new Map(),em=new Map();let ni=0;
  for(let q=-2;q<=2;q++)for(let r=Math.max(-2,-q-2);r<=Math.min(2,-q+2);r++){
    const x=350+Math.sqrt(3)*58*(q+r/2),y=310+87*r,type=types[tiles.length],vs=[];
    for(let k=0;k<6;k++){const angle=(60*k-30)*Math.PI/180,vx=+(x+58*Math.cos(angle)).toFixed(3),vy=+(y+58*Math.sin(angle)).toFixed(3),key=`${vx.toFixed(1)},${vy.toFixed(1)}`;
      if(!vm.has(key)){vm.set(key,vertices.length);vertices.push({id:vertices.length,x:vx,y:vy,tiles:[],edges:[],owner:null,city:false});}const id=vm.get(key);vertices[id].tiles.push(tiles.length);vs.push(id);
    }
    const es=vs.map((v,k)=>{const ends=[v,vs[(k+1)%6]].sort((a,b)=>a-b),key=ends.join('-');if(!em.has(key)){em.set(key,edges.length);const id=edges.length;edges.push({id,ends,owner:null,tiles:[]});ends.forEach(i=>vertices[i].edges.push(id));}const id=em.get(key);edges[id].tiles.push(tiles.length);return id;});
    tiles.push({id:tiles.length,x,y,type,number:type==='desert'?null:numbers[ni++],vertices:vs,edges:es});
  }
  // Arrange number tokens in a coast-to-centre spiral; adjacent red numbers are forbidden.
  const spiral=[...tiles].sort((a,b)=>{const ring=t=>Math.max(Math.abs((t.x-350)/Math.sqrt(3)/58-(t.y-310)/174),Math.abs((t.y-310)/87),Math.abs((t.x-350)/Math.sqrt(3)/58+(t.y-310)/174));return Math.round(ring(b))-Math.round(ring(a))||Math.atan2(a.y-310,a.x-350)-Math.atan2(b.y-310,b.x-350);});
  ni=0;spiral.forEach(t=>{if(t.type!=='desert')t.number=numbers[ni++];});
  // Deterministic repair also supports constant injected RNGs used by tests.
  for(let pass=0;pass<100;pass++){const bad=tiles.find(t=>[6,8].includes(t.number)&&t.edges.some(e=>edges[e].tiles.some(id=>id!==t.id&&[6,8].includes(tiles[id].number))));if(!bad)break;const other=tiles.find(t=>t.number&&![6,8].includes(t.number)&&t.edges.every(e=>edges[e].tiles.every(id=>id===bad.id||![6,8].includes(tiles[id].number))));if(!other)break;[bad.number,other.number]=[other.number,bad.number];}
  const coast=edges.filter(e=>e.tiles.length===1).sort((a,b)=>{const angle=e=>Math.atan2((vertices[e.ends[0]].y+vertices[e.ends[1]].y)/2-310,(vertices[e.ends[0]].x+vertices[e.ends[1]].x)/2-350);return angle(a)-angle(b);});
  const ports=['any','wood','any','brick','wool','any','grain','any','ore'].map((type,i)=>({type,edge:coast[Math.floor(i*30/9)].id,vertices:coast[Math.floor(i*30/9)].ends}));
  return {tiles,vertices,edges,ports};
}
export function longestRoad(board,id){
  function walk(v,used){if(used.size&&board.vertices[v].owner&&board.vertices[v].owner!==id)return used.size;let best=used.size;for(const ei of board.vertices[v].edges){const edge=board.edges[ei];if(edge.owner!==id||used.has(ei))continue;const next=new Set(used);next.add(ei);best=Math.max(best,walk(edge.ends.find(x=>x!==v),next));}return best;}
  return Math.max(0,...board.vertices.map(v=>walk(v.id,new Set())));
}
