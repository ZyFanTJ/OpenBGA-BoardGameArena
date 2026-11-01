import Phaser from 'phaser';
import {WIDTH,HEIGHT,PATH,PADS,LENGTH,pointAt,TOWERS,ENEMIES,towerStats} from '../../../../packages/games/tidewatch/legacy-catalog.js';

type Entity={id:number;kind:string;sector:number;d:number;hp:number;maxHp:number;slow:number;crossings:number;[key:string]:any};
type GameView={time:number;phase:string;enemies:Entity[];towers:any[];players:any[];events:any[];[key:string]:any};
type Effect={object:Phaser.GameObjects.GameObject;end:number};
const color=(hex:string)=>Number.parseInt(hex.slice(1),16);

export class TideScene extends Phaser.Scene {
 view:GameView|null=null;previous:GameView|null=null;sector=0;selected:number|null=null;preview:string|null=null;aiming:string|null=null;
 receivedAt=0;lastEvent=0;initialized=false;reduced=false;verticalScale=1;
 metrics:HTMLOutputElement|null=null;nextMetricsAt=0;metricFrames=0;metricStart=0;
 monsters=new Map<number,Phaser.GameObjects.Image>();buildings=new Map<number,Phaser.GameObjects.Image>();labels=new Map<number,Phaser.GameObjects.Text>();
 ground!:Phaser.GameObjects.Graphics;ranges!:Phaser.GameObjects.Graphics;bars!:Phaser.GameObjects.Graphics;
 effects:Effect[]=[];onAim:(d:number)=>void;onSound:(kind:string)=>void;
 constructor(onAim:(d:number)=>void,onSound:(kind:string)=>void){super('Tidewatch');this.onAim=onAim;this.onSound=onSound;}
 preload(){this.load.image('island','/assets/tidewatch/island-v1.png');this.load.image('units','/assets/tidewatch/units-v1.png');}
 create(){
  this.cameras.main.setOrigin(0,0).setZoom(1,this.verticalScale);
  this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(new URLSearchParams(location.search).has('tdDiagnostics')){this.metrics=document.createElement('output');this.metrics.className='td-perf';this.metrics.setAttribute('aria-label','战场性能');this.game.canvas.parentElement?.append(this.metrics);this.events.once('shutdown',()=>this.metrics?.remove());}
  const texture=this.textures.get('units'),source=texture.getSourceImage() as HTMLImageElement;
  for(let i=0;i<16;i++)texture.add(i,0,Math.floor(i%4*source.width/4),Math.floor(Math.floor(i/4)*source.height/4),Math.floor(source.width/4),Math.floor(source.height/4));
  this.add.image(400,320,'island').setDisplaySize(WIDTH,HEIGHT);
  this.ground=this.add.graphics().setDepth(1);
  const points=PATH.map(p=>new Phaser.Math.Vector2(p[0],p[1]));
  for(const [width,tint] of [[76,0x5b7553],[66,0xaa9a73],[58,0xd9c79c]]){this.ground.lineStyle(width,tint,1);this.ground.strokePoints(points,false);for(const p of PATH.slice(1,-1))this.ground.fillStyle(tint).fillCircle(p[0],p[1],width/2);}
  this.ground.lineStyle(2,0xf4e8c5,.6);
  for(let d=30;d<LENGTH;d+=65){const p=pointAt(d);this.ground.fillStyle(0x9d906c,.35).fillCircle(p.x,p.y,2);}
  for(const p of PADS){this.ground.fillStyle(0x183d35,.24).fillEllipse(p.x,p.y+12,75,40);this.ground.fillStyle(0xe1d5ad,.92).fillEllipse(p.x,p.y+3,66,40);this.ground.lineStyle(2,0xf9e9be,.9).strokeEllipse(p.x,p.y+3,66,40);this.ground.lineStyle(3,0x7e8c6a,.9).lineBetween(p.x-8,p.y+3,p.x+8,p.y+3).lineBetween(p.x,p.y-5,p.x,p.y+11);}
  this.add.text(35,84,'→',{fontFamily:'sans-serif',fontSize:'28px',color:'#fff6d8',stroke:'#365f56',strokeThickness:4}).setDepth(10);
  this.add.text(725,545,'→',{fontFamily:'sans-serif',fontSize:'28px',color:'#fff6d8',stroke:'#365f56',strokeThickness:4}).setDepth(10);
  this.ranges=this.add.graphics().setDepth(2);this.bars=this.add.graphics().setDepth(10000);
  this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{if(!this.aiming)return;let nearest=0,best=Infinity;for(let d=0;d<=LENGTH;d+=10){const p=pointAt(d),dist=Phaser.Math.Distance.Between(pointer.x,pointer.y/this.verticalScale,p.x,p.y);if(dist<best){best=dist;nearest=d;}}this.onAim(nearest);});
  this.initialized=true;this.reconcile();
 }
 setLayout(height:number){
  this.verticalScale=height/HEIGHT;
  if(!this.initialized)return;
  this.cameras.main.setOrigin(0,0).setZoom(1,this.verticalScale);
  for(const object of this.children.list)if(object instanceof Phaser.GameObjects.Text)object.setScale(1,1/this.verticalScale);
  this.reconcile();
 }
 setView(view:GameView,sector:number,selection:number|null,preview:string|null,aiming:string|null){
  const changed=this.sector!==sector;
  if(view!==this.view){this.previous=this.view;this.view=view;this.receivedAt=performance.now();}
  this.sector=sector;this.selected=selection;this.preview=preview;this.aiming=aiming;
  if(!this.initialized)return;
  if(changed){for(const item of [...this.monsters.values(),...this.buildings.values(),...this.labels.values()])item.destroy();this.monsters.clear();this.buildings.clear();this.labels.clear();for(const fx of this.effects)fx.object.destroy();this.effects=[];this.previous=null;}
  this.reconcile();
 }
 reconcile(){
  if(!this.initialized||!this.view)return;const s=this.view;
  const enemies=s.enemies.filter(e=>e.sector===this.sector),ids=new Set(enemies.map(e=>e.id));
  for(const [id,sprite] of this.monsters)if(!ids.has(id)){sprite.destroy();this.monsters.delete(id);}
  for(const e of enemies){const size=e.kind==='boss'?94:e.kind==='swarm'?38:52;if(!this.monsters.has(e.id)){const p=pointAt(e.d);this.monsters.set(e.id,this.add.image(p.x,p.y-12,'units',ENEMIES[e.kind].frame));}this.monsters.get(e.id)!.setDisplaySize(size,size/this.verticalScale);}
  const towers=s.towers.filter(t=>t.sector===this.sector),towerIds=new Set(towers.map(t=>t.id));
  for(const [id,sprite] of this.buildings)if(!towerIds.has(id)){sprite.destroy();this.buildings.delete(id);this.labels.get(id)?.destroy();this.labels.delete(id);}
  for(const t of towers){const pad=PADS[t.pad],frame=t.level>=3&&t.kind==='arrow'?6:t.level>=3&&t.kind==='mortar'?7:TOWERS[t.kind].frame;let sprite=this.buildings.get(t.id);if(!sprite){sprite=this.add.image(pad.x,pad.y-25,'units',frame);this.buildings.set(t.id,sprite);this.labels.set(t.id,this.add.text(pad.x,pad.y+24,'',{fontFamily:'sans-serif',fontSize:'15px',fontStyle:'bold',color:'#fff4cb',stroke:'#29483a',strokeThickness:5}).setOrigin(.5));}sprite.setFrame(frame).setDisplaySize(84+t.level*5,(84+t.level*5)/this.verticalScale).setDepth(pad.y+100);this.labels.get(t.id)!.setText('◆'.repeat(t.level)).setScale(1,1/this.verticalScale).setDepth(pad.y+102);}
  this.ranges.clear();
  if(this.selected!==null){const p=PADS[this.selected],t=towers.find(t=>t.pad===p.id),kind=this.preview??t?.kind;const own=s.players[this.sector];if(kind){const radius=towerStats(t??{kind,level:1},own).range;if(radius)this.ranges.fillStyle(0xa9ead1,.13).fillCircle(p.x,p.y,radius).lineStyle(2,0xdef8dc,.8).strokeCircle(p.x,p.y,radius);}this.ranges.lineStyle(4,0xffdc85).strokeEllipse(p.x,p.y+3,82,52);}
  if(!this.lastEvent){this.lastEvent=s.events.at(-1)?.id??0;return;}
  for(const event of s.events){if(event.id<=this.lastEvent)continue;if(event.sector===this.sector)this.showEvent(event);}
  this.lastEvent=Math.max(this.lastEvent,s.events.at(-1)?.id??0);
 }
 hold(object:Phaser.GameObjects.GameObject,ms:number){while(this.effects.length>=120){const oldest=this.effects.shift()!;this.tweens.killTweensOf(oldest.object);oldest.object.destroy();}this.effects.push({object,end:this.time.now+ms});}
 showEvent(e:any){
  if(this.effects.length>100)return;
  if(e.type==='shot'){
   const pad=PADS[e.pad],targets=e.targets.map((t:any)=>pointAt(t.d)),tint=color(TOWERS[e.kind].color),last=targets[0];if(!last)return;
   if(e.kind==='storm'){const line=this.add.graphics().setDepth(9000).lineStyle(3,tint,.9);let from={x:pad.x,y:pad.y-35};for(const p of targets){line.lineBetween(from.x,from.y,p.x,p.y);from=p;}this.hold(line,130);}
   else {const bullet=this.add.circle(pad.x,pad.y-35,e.kind==='mortar'?7:4,tint).setDepth(9000);this.hold(bullet,280);this.tweens.add({targets:bullet,x:last.x,y:last.y,duration:this.reduced?80:180,onComplete:()=>{if(e.kind==='mortar'||e.kind==='frost')this.ring(last.x,last.y,tint,e.kind==='mortar'?70:45);}});}
   this.onSound(e.kind);
  }else if(e.type==='kill'){const p=pointAt(e.d);this.ring(p.x,p.y,0xffe5a3,e.kind==='boss'?80:20);if(e.combo>=3&&e.combo%3===0)this.float(p.x,p.y,`×${e.combo}`,'#ffe29a');}
  else if(e.type==='build'||e.type==='upgrade'){const p=PADS[e.pad];this.ring(p.x,p.y,0xffe5a3,65);if(e.type==='upgrade')this.float(p.x,p.y-40,'◆'.repeat(e.level),'#fff3bd');this.onSound('build');}
  else if(e.type==='skill'){const p=pointAt(e.d);this.ring(p.x,p.y,e.skill==='meteor'?0xffb67a:0x91ecff,180);this.onSound('skill');}
 }
 ring(x:number,y:number,tint:number,radius:number){const ring=this.add.circle(x,y,8,tint,.22).setStrokeStyle(3,tint,.8).setDepth(8500);this.hold(ring,450);this.tweens.add({targets:ring,scale:radius/8,alpha:0,duration:this.reduced?160:400});}
 float(x:number,y:number,text:string,tint:string){const label=this.add.text(x,y,text,{fontFamily:'sans-serif',fontSize:'21px',fontStyle:'bold',color:tint,stroke:'#284a41',strokeThickness:5}).setOrigin(.5).setScale(1,1/this.verticalScale).setDepth(10001);this.hold(label,950);this.tweens.add({targets:label,y:y-30,alpha:0,duration:900});}
 update(time:number){
  if(!this.view||!this.initialized)return;const s=this.view,alpha=Math.min(1,Math.max(0,(performance.now()-this.receivedAt)/200));
  if(this.metrics){this.metricFrames++;if(time>=this.nextMetricsAt){this.metrics.textContent=`${Math.round(this.metricFrames*1000/Math.max(1,time-this.metricStart))} FPS · ${s.enemies.length} 怪 · ${s.towers.length} 塔 · ${this.effects.length} 特效`;this.metricFrames=0;this.metricStart=time;this.nextMetricsAt=time+1000;}}
  const previous=new Map((this.previous?.enemies??[]).map(e=>[e.id,e]));this.bars.clear();
  for(const e of s.enemies){const sprite=this.monsters.get(e.id);if(!sprite)continue;const old=previous.get(e.id),d=old?.sector===e.sector?old.d+(e.d-old.d)*alpha:e.d,p=pointAt(d);const bob=this.reduced?0:Math.sin(time/130+e.id)*2;sprite.setPosition(p.x,p.y-14+bob).setDepth(p.y+90).setFlipX(Math.cos(p.angle)<-.2);sprite.setAngle(this.reduced?0:Math.sin(time/170+e.id)*2);if(e.slow<1)sprite.setTint(0xc5f4ff);else sprite.clearTint();
   if(e.hp<e.maxHp||e.kind==='boss'){const w=e.kind==='boss'?64:34,y=p.y-(e.kind==='boss'?60:43);this.bars.fillStyle(0x183d35,.85).fillRoundedRect(p.x-w/2,y,w,5,2);this.bars.fillStyle(e.kind==='boss'?0xf1ac77:0x9ee1ac).fillRoundedRect(p.x-w/2,y,w*Math.max(0,e.hp/e.maxHp),5,2);}
  }
  this.effects=this.effects.filter(fx=>{if(fx.end>time)return true;fx.object.destroy();return false;});
 }
}

export function mountBattle(parent:HTMLElement,onAim:(d:number)=>void,onSound:(kind:string)=>void){
 const scene=new TideScene(onAim,onSound);
 const logicalHeight=()=>{const bounds=parent.getBoundingClientRect();return bounds.width>0?Math.round(WIDTH*bounds.height/bounds.width):HEIGHT;};
 let height=logicalHeight();scene.verticalScale=height/HEIGHT;
 const game=new Phaser.Game({type:Phaser.WEBGL,parent,width:WIDTH,height,backgroundColor:'#173f40',scene:[scene],banner:false,
  loader:{imageLoadType:'HTMLImageElement'},
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,roundPixels:false},fps:{target:60,limit:60,smoothStep:true},audio:{noAudio:true}});
 const observer=new ResizeObserver(()=>{const next=logicalHeight();if(next>0&&next!==height){height=next;game.scale.setGameSize(WIDTH,height);scene.setLayout(height);}else game.scale.refresh();});observer.observe(parent);
 return {scene,destroy:()=>{observer.disconnect();game.destroy(true);}};
}



