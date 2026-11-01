import Phaser from 'phaser';
import {WIDTH,HEIGHT,PATH,PADS,LENGTH,pointAt,TOWERS,ENEMIES,RARITIES,towerStats,ROUTES,TERRAIN,routeLength} from '../../../../packages/games/tidewatch/catalog.js';

type Entity={id:number;kind:string;sector:number;d:number;hp:number;maxHp:number;slow:number;crossings:number;[key:string]:any};
type GameView={time:number;phase:string;enemies:Entity[];towers:any[];players:any[];events:any[];[key:string]:any};
type Effect={object:Phaser.GameObjects.GameObject;end:number};
const color=(hex:string)=>Number.parseInt(hex.slice(1),16);

export class TideScene extends Phaser.Scene {
 view:GameView|null=null;previous:GameView|null=null;sector=0;selected:number|null=null;preview:string|null=null;aiming:string|null=null;
 receivedAt=0;lastEvent=0;initialized=false;reduced=false;verticalScale=1;
 metrics:HTMLOutputElement|null=null;nextMetricsAt=0;metricFrames=0;metricStart=0;
 monsters=new Map<number,Phaser.GameObjects.Image>();buildings=new Map<number,Phaser.GameObjects.Image>();labels=new Map<number,Phaser.GameObjects.Text>();
 mapRoute='';zoom=1;viewX=0;viewY=0;onViewport:()=>void;halos!:Phaser.GameObjects.Graphics;mapLabels=new Map<number,Phaser.GameObjects.Text>();
 ground!:Phaser.GameObjects.Graphics;ranges!:Phaser.GameObjects.Graphics;bars!:Phaser.GameObjects.Graphics;
 effects:Effect[]=[];onAim:(d:number)=>void;onSound:(kind:string)=>void;
 constructor(onAim:(d:number)=>void,onSound:(kind:string)=>void,onViewport=()=>{}){super('Tidewatch');this.onAim=onAim;this.onSound=onSound;this.onViewport=onViewport;this.zoom=matchMedia('(max-width:760px)').matches?1.25:1;}
 preload(){this.load.image('island','/assets/tidewatch/island-v2.webp');this.load.image('towers','/assets/tidewatch/towers-v2.png');this.load.image('enemies','/assets/tidewatch/enemies-v2.png');}
 create(){
  this.cameras.main.setOrigin(0,0).setZoom(this.verticalScale*this.zoom).setScroll(this.viewX,this.viewY);
  this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(new URLSearchParams(location.search).has('tdDiagnostics')){this.metrics=document.createElement('output');this.metrics.className='td-perf';this.metrics.setAttribute('aria-label','战场性能');this.game.canvas.parentElement?.append(this.metrics);this.events.once('shutdown',()=>this.metrics?.remove());}
  for(const [key,cols,count] of [['towers',6,24],['enemies',4,16]] as const){const texture=this.textures.get(key);for(let i=0;i<count;i++)texture.add(i,0,i%cols*192,Math.floor(i/cols)*192,192,192);}
  this.add.image(WIDTH/2,HEIGHT/2,'island').setDisplaySize(WIDTH,HEIGHT);
  this.ground=this.add.graphics().setDepth(1);
  const points=PATH.map(p=>new Phaser.Math.Vector2(p[0],p[1]));
  for(const [width,tint] of [[76,0x5b7553],[66,0xaa9a73],[58,0xd9c79c]]){this.ground.lineStyle(width,tint,1);this.ground.strokePoints(points,false);for(const p of PATH.slice(1,-1))this.ground.fillStyle(tint).fillCircle(p[0],p[1],width/2);}
  this.ground.lineStyle(2,0xf4e8c5,.6);
  for(let d=30;d<LENGTH;d+=65){const p=this.at(d);this.ground.fillStyle(0x9d906c,.35).fillCircle(p.x,p.y,2);}
  for(const p of PADS){this.ground.fillStyle(0x183d35,.24).fillEllipse(p.x,p.y+12,75,40);this.ground.fillStyle(0xe1d5ad,.92).fillEllipse(p.x,p.y+3,66,40);this.ground.lineStyle(2,0xf9e9be,.9).strokeEllipse(p.x,p.y+3,66,40);this.ground.lineStyle(3,0x7e8c6a,.9).lineBetween(p.x-8,p.y+3,p.x+8,p.y+3).lineBetween(p.x,p.y-5,p.x,p.y+11);}
  this.add.text(35,120,'→',{fontFamily:'sans-serif',fontSize:'28px',color:'#fff6d8',stroke:'#365f56',strokeThickness:4}).setDepth(10);
  this.add.text(1110,800,'→',{fontFamily:'sans-serif',fontSize:'28px',color:'#fff6d8',stroke:'#365f56',strokeThickness:4}).setDepth(10);
  this.halos=this.add.graphics().setDepth(3);this.ranges=this.add.graphics().setDepth(4);
  for(const p of PADS)this.mapLabels.set(p.id,this.add.text(p.x,p.y+17,'',{fontFamily:'sans-serif',fontSize:'17px',fontStyle:'bold',color:TERRAIN[p.terrain].color,stroke:'#17322d',strokeThickness:4}).setOrigin(.5).setDepth(5));this.bars=this.add.graphics().setDepth(10000);
  this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{if(!this.aiming)return;let nearest=0,best=Infinity;for(let d=0;d<=routeLength(this.view?.players[this.sector].route);d+=10){const p=this.at(d),dist=Phaser.Math.Distance.Between(pointer.x/(this.verticalScale*this.zoom)+this.viewX,pointer.y/this.verticalScale/this.zoom+this.viewY,p.x,p.y);if(dist<best){best=dist;nearest=d;}}this.onAim(nearest);});
  this.initialized=true;this.panTo(this.viewX,this.viewY);this.reconcile();
 }
 setLayout(height:number){
  this.verticalScale=height/HEIGHT;
  if(!this.initialized)return;this.panTo(this.viewX,this.viewY);
  this.cameras.main.setOrigin(0,0).setZoom(this.verticalScale*this.zoom).setScroll(this.viewX,this.viewY);
  for(const object of this.children.list)if(object instanceof Phaser.GameObjects.Text)object.setScale(1);
  this.reconcile();
 }

 at(d:number){return pointAt(d,this.view?.players[this.sector]?.route??'bay');}
 get viewport(){return {zoomX:this.verticalScale*this.zoom,zoomY:this.zoom,x:this.viewX,y:this.viewY};}
 panTo(x:number,y:number){const vw=WIDTH/(this.verticalScale*this.zoom),vh=HEIGHT/this.zoom;this.viewX=vw>=WIDTH?(WIDTH-vw)/2:Math.max(0,Math.min(WIDTH-vw,x));this.viewY=vh>=HEIGHT?(HEIGHT-vh)/2:Math.max(0,Math.min(HEIGHT-vh,y));if(this.initialized)this.cameras.main.setZoom(this.verticalScale*this.zoom).setScroll(this.viewX,this.viewY);this.onViewport();}
 fitMap(){this.zoom=Math.min(1,1/this.verticalScale);this.panTo(0,0);}
 zoomBy(factor:number){const old=this.zoom;this.zoom=Math.max(Math.min(1,1/this.verticalScale),Math.min(2.5,old*factor));this.panTo(this.viewX+WIDTH/this.verticalScale/old/2-WIDTH/this.verticalScale/this.zoom/2,this.viewY+HEIGHT/old/2-HEIGHT/this.zoom/2);}
 drawMap(){const route=this.view?.players[this.sector]?.route??'bay';if(route===this.mapRoute)return;this.mapRoute=route;this.ground.clear();for(const [id,r] of Object.entries(ROUTES)){const pts=r.points.map((p:number[])=>new Phaser.Math.Vector2(p[0],p[1]));if(id!==route){this.ground.lineStyle(13,0x789a91,.3).strokePoints(pts,false);continue;}for(const [width,tint] of [[67,0x546b4d],[58,0xa18b62],[48,0xd8c59a]]){this.ground.lineStyle(width,tint,1).strokePoints(pts,false);for(const p of r.points.slice(1,-1))this.ground.fillStyle(tint).fillCircle(p[0],p[1],width/2);}}for(const p of PADS){const tint=color(TERRAIN[p.terrain].color);this.ground.fillStyle(0x143b34,.45).fillEllipse(p.x,p.y+8,92,58);this.ground.fillStyle(tint,.3).fillEllipse(p.x,p.y+3,78,46);this.ground.lineStyle(3,tint,.9).strokeEllipse(p.x,p.y+3,78,46);}}
 setView(view:GameView,sector:number,selection:number|null,preview:string|null,aiming:string|null){
  const changed=this.sector!==sector;
  if(view!==this.view){this.previous=this.view;this.view=view;this.receivedAt=performance.now();}
  this.sector=sector;this.selected=selection;this.preview=preview;this.aiming=aiming;
  if(!this.initialized)return;
  if(changed){this.mapRoute='';this.panTo(0,0);for(const item of [...this.monsters.values(),...this.buildings.values(),...this.labels.values()])item.destroy();this.monsters.clear();this.buildings.clear();this.labels.clear();for(const fx of this.effects)fx.object.destroy();this.effects=[];this.previous=null;}
  this.reconcile();
 }
 reconcile(){
  if(!this.initialized||!this.view)return;const s=this.view;this.drawMap();const owner=s.players[this.sector];for(const p of PADS)this.mapLabels.get(p.id)?.setText(owner.unlocked?.includes(p.id)?TERRAIN[p.terrain].glyph:'+'+p.cost).setScale(1);this.halos.clear();
  const enemies=s.enemies.filter(e=>e.sector===this.sector),ids=new Set(enemies.map(e=>e.id));
  for(const [id,sprite] of this.monsters)if(!ids.has(id)){sprite.destroy();this.monsters.delete(id);}
  for(const e of enemies){const boss=['boss','gold','crystal','ancient'].includes(e.kind),size=boss?104:e.kind==='swarm'?40:54;if(!this.monsters.has(e.id)){const p=this.at(e.d);this.monsters.set(e.id,this.add.image(p.x,p.y-12,'enemies',ENEMIES[e.kind].frame));}this.monsters.get(e.id)!.setDisplaySize(size,size);}
  const towers=s.towers.filter(t=>t.sector===this.sector),towerIds=new Set(towers.map(t=>t.id));
  for(const [id,sprite] of this.buildings)if(!towerIds.has(id)){sprite.destroy();this.buildings.delete(id);this.labels.get(id)?.destroy();this.labels.delete(id);}
  for(const t of towers){const pad=PADS[t.pad],def=TOWERS[t.kind];if(!t.temporary){const tint=color(RARITIES[def.rarity].color),w=96+def.rarity*18,h=58+def.rarity*11;this.halos.fillStyle(tint,.12).fillEllipse(pad.x,pad.y+3,w+26,h+17).fillStyle(tint,.29).fillEllipse(pad.x,pad.y+3,w,h).lineStyle(3+def.rarity,tint,.95).strokeEllipse(pad.x,pad.y+3,w,h);if(def.rarity>=2)this.halos.lineStyle(2,tint,.65).strokeEllipse(pad.x,pad.y+3,w+17,h+11);}const frame=t.temporary?12:def.frame;let sprite=this.buildings.get(t.id);if(!sprite){sprite=this.add.image(pad.x+(t.offsetX??0),pad.y-25,t.temporary?'enemies':'towers',frame);this.buildings.set(t.id,sprite);this.labels.set(t.id,this.add.text(pad.x,pad.y+24,'',{fontFamily:'sans-serif',fontSize:'15px',fontStyle:'bold',color:RARITIES[def.rarity].color,stroke:'#223e35',strokeThickness:5}).setOrigin(.5));}const size=t.temporary?46:80+def.rarity*7+(t.star===2?7:0)+((t.baseLevel??1)-1)*6;sprite.setPosition(pad.x+(t.offsetX??0),pad.y-25).setFrame(frame).setDisplaySize(size,size).setDepth(pad.y+100);if(t.star===2)sprite.setTint(0xfff2cf);else sprite.clearTint();this.labels.get(t.id)!.setPosition(pad.x,pad.y+24).setText(t.temporary?'':'★'.repeat(t.star??1)+((t.baseLevel??1)>1?' · '+['','I','II','III'][t.baseLevel]:'')).setScale(1).setDepth(pad.y+102);}
  this.ranges.clear();
  if(this.selected!==null){const p=PADS[this.selected],t=towers.find(t=>t.pad===p.id),kind=this.preview??t?.kind;const own=s.players[this.sector];if(kind){const radius=towerStats(t??{kind,star:1},own,s).range;if(radius)this.ranges.fillStyle(0xa9ead1,.13).fillCircle(p.x,p.y,radius).lineStyle(2,0xdef8dc,.8).strokeCircle(p.x,p.y,radius);}if(t){const st=towerStats(t,own,s);if(st.aura){this.ranges.lineStyle(2,0xade8b4,.7).strokeCircle(p.x,p.y,st.auraRadius);for(const other of towers.filter(x=>x.id!==t.id&&Math.hypot(PADS[x.pad].x-p.x,PADS[x.pad].y-p.y)<st.auraRadius))this.ranges.lineStyle(3,0xbdebc1,.85).lineBetween(p.x,p.y,PADS[other.pad].x,PADS[other.pad].y);}}this.ranges.lineStyle(4,0xffdc85).strokeEllipse(p.x,p.y+3,82,52);}
  if(!this.lastEvent){this.lastEvent=s.events.at(-1)?.id??0;return;}
  for(const event of s.events){if(event.id<=this.lastEvent)continue;if(event.sector===this.sector)this.showEvent(event);}
  this.lastEvent=Math.max(this.lastEvent,s.events.at(-1)?.id??0);
 }
 hold(object:Phaser.GameObjects.GameObject,ms:number){while(this.effects.length>=120){const oldest=this.effects.shift()!;this.tweens.killTweensOf(oldest.object);oldest.object.destroy();}this.effects.push({object,end:this.time.now+ms});}
 showEvent(e:any){
  if(this.effects.length>100)return;
  if(e.type==='shot'||e.type==='volley'){
   const pad=PADS[e.pad],def=TOWERS[e.kind];if(!pad||!def)return;const targets=(e.targets??[{d:e.d}]).map((t:any)=>pointAt(t.d,e.route??this.view?.players[this.sector]?.route??'bay')),tint=color(def.color),last=targets[0];if(!last)return;
   if(def.faction==='tide'&&(def.chain||e.type==='volley')){const line=this.add.graphics().setDepth(9000).lineStyle(3,tint,.95);let from={x:pad.x,y:pad.y-35};for(const p of targets){line.lineBetween(from.x,from.y,(from.x+p.x)/2+7,(from.y+p.y)/2-7).lineBetween((from.x+p.x)/2+7,(from.y+p.y)/2-7,p.x,p.y);from=p;}this.hold(line,160);}
   else if(def.faction==='star'){const line=this.add.graphics().setDepth(9000).lineStyle(2,tint,.85);for(const p of targets)line.lineBetween(pad.x,pad.y-35,p.x,p.y);this.hold(line,160);}
   else {for(const p of targets.slice(0,4)){const bullet=this.add.circle(pad.x,pad.y-35,def.faction==='ember'?6:3,tint).setDepth(9000);this.hold(bullet,280);this.tweens.add({targets:bullet,x:p.x,y:p.y,duration:this.reduced?80:180,onComplete:()=>{if(def.splash)this.ring(p.x,p.y,tint,def.splash*.65);}});}}
   this.onSound(def.faction);
  }else if(e.type==='proc'){const p=this.at(e.d);this.ring(p.x,p.y,color(({tide:'#78dce5',ember:'#ef9c72',gear:'#e5bf70',star:'#c6aff8'} as any)[e.faction]),e.faction==='ember'?125:75);if(e.targets){const line=this.add.graphics().setDepth(9000).lineStyle(4,0x99eff4,.9);let from=p;for(const q of e.targets){const to=this.at(q.d);line.lineBetween(from.x,from.y,to.x,to.y);from=to;}this.hold(line,170);}}
  else if(e.type==='beam'){const line=this.add.graphics().setDepth(9000).lineStyle(7,e.faction==='tide'?0x92ecf2:e.faction==='gear'?0xf4d695:0xe7c4ff,.75),points=[];for(let d=Math.max(0,e.d);d<=Math.min(routeLength(this.view?.players[this.sector].route),e.endD);d+=20){const p=this.at(d);points.push(new Phaser.Math.Vector2(p.x,p.y));}line.strokePoints(points);this.hold(line,300);}
  else if(e.type==='kill'){const p=this.at(e.d);this.ring(p.x,p.y,0xffe5a3,['boss','gold','crystal','ancient'].includes(e.kind)?80:18);}
  else if(['build','upgrade','evolve','growth'].includes(e.type)){const p=PADS[e.pad];this.ring(p.x,p.y,e.type==='evolve'?0xdab5ff:0xffe5a3,e.type==='evolve'?95:60);if(e.type!=='build')this.float(p.x,p.y-40,e.type==='evolve'?'进化':e.type==='growth'?'成长 '+['','I','II','III'][e.level]:'★★','#fff3bd');this.onSound('build');}
  else if(e.type==='skill'){const p=this.at(e.d);this.ring(p.x,p.y,e.skill==='meteor'?0xffb67a:0x91ecff,180);this.onSound('skill');}
  else if(e.type==='bountyStart')this.float(400,90,'悬赏入场','#f5c985');
 }

 ring(x:number,y:number,tint:number,radius:number){const ring=this.add.circle(x,y,8,tint,.22).setStrokeStyle(3,tint,.8).setDepth(8500);this.hold(ring,450);this.tweens.add({targets:ring,scale:radius/8,alpha:0,duration:this.reduced?160:400});}
 float(x:number,y:number,text:string,tint:string){const label=this.add.text(x,y,text,{fontFamily:'sans-serif',fontSize:'21px',fontStyle:'bold',color:tint,stroke:'#284a41',strokeThickness:5}).setOrigin(.5).setScale(1).setDepth(10001);this.hold(label,950);this.tweens.add({targets:label,y:y-30,alpha:0,duration:900});}
 update(time:number){
  if(!this.view||!this.initialized)return;this.halos.setAlpha(this.reduced?1:.88+Math.sin(time/700)*.12);const s=this.view,alpha=Math.min(1,Math.max(0,(performance.now()-this.receivedAt)/200));
  if(this.metrics){this.metricFrames++;if(time>=this.nextMetricsAt){this.metrics.textContent=`${Math.round(this.metricFrames*1000/Math.max(1,time-this.metricStart))} FPS · ${s.enemies.length} 怪 · ${s.towers.length} 塔 · ${this.effects.length} 特效`;this.metricFrames=0;this.metricStart=time;this.nextMetricsAt=time+1000;}}
  const previous=new Map((this.previous?.enemies??[]).map(e=>[e.id,e]));this.bars.clear();
  for(const e of s.enemies){const sprite=this.monsters.get(e.id);if(!sprite)continue;const old=previous.get(e.id),d=old?.sector===e.sector?old.d+(e.d-old.d)*alpha:e.d,p=this.at(d);const bob=this.reduced?0:Math.sin(time/130+e.id)*2;sprite.setPosition(p.x,p.y-14+bob).setDepth(p.y+90).setFlipX(Math.cos(p.angle)<-.2);sprite.setAngle(this.reduced?0:Math.sin(time/170+e.id)*2);if(e.burning)sprite.setTint(0xffc0a0);else if(e.wet||e.slow<1)sprite.setTint(0xc5f4ff);else if(e.marked)sprite.setTint(0xead3ff);else sprite.clearTint();
   if(e.hp<e.maxHp||['boss','gold','crystal','ancient'].includes(e.kind)){const boss=['boss','gold','crystal','ancient'].includes(e.kind),w=boss?70:34,y=p.y-(boss?64:43);this.bars.fillStyle(0x183d35,.85).fillRoundedRect(p.x-w/2,y,w,5,2);this.bars.fillStyle(e.bounty?0xf1ac77:0x9ee1ac).fillRoundedRect(p.x-w/2,y,w*Math.max(0,e.hp/e.maxHp),5,2);}
  }
  for(const z of s.zones??[]){if(z.sector!==this.sector)continue;const p=this.at(z.d),tint=z.kind==='fire'?0xf3a06c:z.kind==='weather'?0x89e0e6:0xa6cbea;this.bars.fillStyle(tint,.14).fillEllipse(p.x,p.y,z.width*1.6,42);this.bars.lineStyle(2,tint,.65).strokeEllipse(p.x,p.y,z.width*1.6,42);if(z.kind==='weather')this.bars.lineStyle(3,tint,.8).lineBetween(p.x-25,p.y-60,p.x+10,p.y).lineBetween(p.x+10,p.y,p.x+35,p.y-45);}
  this.effects=this.effects.filter(fx=>{if(fx.end>time)return true;fx.object.destroy();return false;});
 }
}

export function mountBattle(parent:HTMLElement,onAim:(d:number)=>void,onSound:(kind:string)=>void,onViewport=()=>{}){
 const scene=new TideScene(onAim,onSound,onViewport);
 const logicalHeight=()=>{const bounds=parent.getBoundingClientRect();return bounds.width>0?Math.round(WIDTH*bounds.height/bounds.width):HEIGHT;};
 let height=logicalHeight();scene.verticalScale=height/HEIGHT;
 const game=new Phaser.Game({type:Phaser.WEBGL,parent,width:WIDTH,height,backgroundColor:'#173f40',scene:[scene],banner:false,
  loader:{imageLoadType:'HTMLImageElement'},
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,roundPixels:false},fps:{target:60,limit:60,smoothStep:true},audio:{noAudio:true}});
 const touches=new Map<number,{x:number;y:number}>();let lastX=0,lastY=0,pinch=0;
 const down=(ev:PointerEvent)=>{if(scene.aiming)return;touches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});lastX=ev.clientX;lastY=ev.clientY;parent.setPointerCapture(ev.pointerId);};
 const move=(ev:PointerEvent)=>{if(!touches.has(ev.pointerId))return;touches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});const points=[...touches.values()];if(points.length===2){const dist=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);if(pinch)scene.zoomBy(dist/pinch);pinch=dist;}else{const b=parent.getBoundingClientRect();scene.panTo(scene.viewX-(ev.clientX-lastX)/b.width*WIDTH/(scene.verticalScale*scene.zoom),scene.viewY-(ev.clientY-lastY)/b.height*HEIGHT/scene.zoom);}lastX=ev.clientX;lastY=ev.clientY;};
 const up=(ev:PointerEvent)=>{touches.delete(ev.pointerId);pinch=0;};parent.addEventListener('pointerdown',down);parent.addEventListener('pointermove',move);parent.addEventListener('pointerup',up);parent.addEventListener('pointercancel',up);
 const observer=new ResizeObserver(()=>{const next=logicalHeight();if(next>0&&next!==height){height=next;game.scale.setGameSize(WIDTH,height);scene.setLayout(height);}else game.scale.refresh();});observer.observe(parent);
 return {scene,destroy:()=>{observer.disconnect();parent.removeEventListener('pointerdown',down);parent.removeEventListener('pointermove',move);parent.removeEventListener('pointerup',up);parent.removeEventListener('pointercancel',up);game.destroy(true);}};
}



