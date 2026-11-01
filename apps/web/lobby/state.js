/** Public lobby state only. No game snapshots or authentication data are cached here. */
export function createLobbyStore(initial) {
 let state={query:'',category:'全部',page:0,rooms:[],recent:[],friends:[],...initial};
 const listeners=new Set();let disposed=false;
 return {
  getSnapshot:()=>state,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  patch(values){if(disposed||Object.entries(values).every(([key,value])=>Object.is(state[key],value)))return;state={...state,...values};for(const listener of listeners)listener();},
  dispose(){disposed=true;listeners.clear();},
 };
}
export function catalogPage(games,{query='',category='全部',page=0,pageSize=6}={}) {
 const needle=query.trim().toLocaleLowerCase(),matches=games.filter(game=>game.title.toLocaleLowerCase().includes(needle)&&(category==='全部'||game.category===category)).sort((a,b)=>Number(b.hot===true)-Number(a.hot===true));
 const size=Math.max(1,pageSize),pages=Math.max(1,Math.ceil(matches.length/size)),index=Math.max(0,Math.min(page,pages-1));
 return {items:matches.slice(index*size,(index+1)*size),count:matches.length,pages,page:index};
}
export function availableTables(rooms,games){const ids=new Set(games.filter(g=>g.enabled!==false).map(g=>g.id));return [...new Map(rooms.map(r=>[r.id,r])).values()].filter(r=>ids.has(r.gameId)&&r.status==='lobby'&&r.count<r.maxPlayers).slice(0,3);}
export const upcomingGames=[
 {id:'werewolf',title:'狼人杀',players:'6–18',duration:'15–30',category:'聚会推理',tags:'推理 · 社交 · 经典',coverClass:'cover-tile cover-0'},
 {id:'avalon',title:'阿瓦隆',players:'5–10',duration:'30–60',category:'策略对战',tags:'身份 · 策略 · 阵营',coverClass:'cover-tile cover-1'},
 {id:'undercover',title:'谁是卧底',players:'4–12',duration:'15–30',category:'聚会推理',tags:'推理 · 聚会 · 轻松',coverClass:'cover-tile cover-2'},
 {id:'ludo',title:'飞行棋',players:'2–4',duration:'15–30',category:'家庭休闲',tags:'休闲 · 亲子 · 经典',coverClass:'cover-tile cover-4'},
];
