export const WIDTH=1200,HEIGHT=900,STEP=50,WAVES=18;
export const ROUTES={
 bay:{name:'内湾长堤',income:0,text:'长路绕行，适合多段控制与持续伤害',points:[[-30,170],[220,170],[220,400],[520,400],[520,180],[920,180],[920,660],[680,660],[680,760],[1230,760]]},
 coast:{name:'近海商道',income:12,text:'短路直达，每波多12金币，留给防线的时间更短',points:[[-30,170],[220,170],[220,400],[980,400],[980,760],[1230,760]]},
 reef:{name:'环礁回廊',income:6,text:'绕过北侧高台，经过南部矿场，每波多6金币',points:[[-30,170],[220,170],[220,600],[520,600],[520,400],[920,400],[920,760],[1230,760]]}
};
export const routeLength=(id='bay')=>ROUTES[id].points.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-ROUTES[id].points[i][0],p[1]-ROUTES[id].points[i][1]),0);
export const PATH=ROUTES.bay.points,LENGTH=routeLength();
export function pointAt(distance,id='bay'){let d=Math.max(0,Math.min(routeLength(id),distance));const path=ROUTES[id].points;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d<=length)return {x:a[0]+(b[0]-a[0])*d/length,y:a[1]+(b[1]-a[1])*d/length,angle:Math.atan2(b[1]-a[1],b[0]-a[0])};d-=length;}return {x:1230,y:760,angle:0};}
export const TERRAIN={plain:{name:'平地',glyph:'·',color:'#c3bd9b',text:'没有地形加成'},high:{name:'高台',glyph:'高',color:'#ceaff1',text:'射程增加20%'},tide:{name:'潮口',glyph:'潮',color:'#6adce1',text:'控制命中额外减速；浸潮多持续一秒'},relay:{name:'中继',glyph:'继',color:'#a7d4a0',text:'辅助范围增加35%，适合连接两片防线'},mine:{name:'矿场',glyph:'矿',color:'#edc874',text:'部署辅助或增幅建筑后，每波多6金币'},wind:{name:'风口',glyph:'风',color:'#9cc5ed',text:'攻击间隔缩短10%'}};
export const PADS=[[110,280,'tide'],[330,290,'relay'],[440,90,'high'],[670,300,'plain'],[830,110,'high'],[1080,320,'wind'],[1050,590,'tide'],[800,550,'relay'],[510,540,'mine',45],[340,530,'mine'],[180,720,'wind'],[530,770,'relay'],[800,845,'high',55],[1110,850,'wind'],[1100,110,'mine',40],[70,520,'tide',35],
 [330,90,'wind'],[550,90,'high',50],[660,90,'plain'],[990,90,'high'],[440,200,'relay'],[990,200,'wind'],[440,310,'plain'],[770,310,'relay'],[110,420,'tide'],[1100,420,'relay',40],[660,530,'wind'],[110,640,'tide',30],[330,750,'plain'],[330,190,'relay'],[1100,700,'wind'],[450,680,'mine',45]].map(([x,y,terrain,cost=0],id)=>({id,x:Number(x),y:Number(y),terrain:String(terrain),cost:Number(cost)}));
export const INITIAL_SITES=PADS.filter(p=>!p.cost).map(p=>p.id);
export function siteScore(kind,pad,range,route){let count=0;for(let d=0;d<routeLength(route);d+=65){const p=pointAt(d,route);if(Math.hypot(p.x-pad.x,p.y-pad.y)<range*(pad.terrain==='high'?1.2:1))count++;}return count;}
