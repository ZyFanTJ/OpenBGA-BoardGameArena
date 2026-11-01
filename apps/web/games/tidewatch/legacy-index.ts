import {mountBattle} from './legacy-scene';
export {mountBattle} from './legacy-scene';
import {TideAudio} from './audio';
import {patchHTML} from './dom';
import {TOWERS,RELICS,SKILLS,PADS,towerStats,costFor,harborCost} from '../../../../packages/games/tidewatch/legacy-catalog.js';
import {guide} from './legacy-guide.js';
import {escapeHtml as escape} from '../../ui.js';
import {resultActions} from '../../result-actions.js';

const e=(v:any)=>escape(String(v??'')),n=(v:number)=>Math.floor(v).toLocaleString('zh-CN');
const art=(kind:string)=>`<span class="td-art td-art-${kind}" aria-hidden="true"></span>`;
const btn=(label:string,action:string,attrs='',disabled=false)=>`<button type="button" data-action="game:${action}" ${attrs} ${disabled?'disabled':''}>${label}</button>`;
const coin=(value:number)=>`<span class="td-coin">◉ ${n(value)}</span>`;

export function createTidewatchRenderer(send:(command:any)=>Promise<any>,rerender:()=>void){
 let container:HTMLElement|null=null,root:HTMLElement|null=null,room:any,user:any,battle:ReturnType<typeof mountBattle>|null=null;
 let sector=0,selected:number|null=null,kind='arrow',tab='build',aiming:string|null=null,busy=false,error='',modal='',confirmSell=false,more=false,lastMatch='';
 let focused=matchMedia('(max-width:760px)').matches;
 const audio=new TideAudio(),htmlCache=new Map<string,string>();
 const me=()=>room?.game.players.find((p:any)=>p.id===user?.id),owner=()=>room?.game.players[sector],mine=()=>sector===room?.game.self?.sector;
 const ownTower=()=>room.game.towers.find((t:any)=>t.sector===sector&&t.pad===selected);
 const name=(id:string)=>room.players.find((p:any)=>p.id===id)?.name??'守望者';
 function setHTML(selector:string,html:string){if(htmlCache.get(selector)===html)return;const el=root?.querySelector(selector);if(el){patchHTML(el,html);htmlCache.set(selector,html);}}
 function mount(el:HTMLElement){
  container?.removeEventListener('keydown',keyboard);container=el;htmlCache.clear();
  el.innerHTML=`<section class="td-game" aria-label="潮汐守望合作塔防"><header class="td-top"><div class="td-status"></div><div class="td-top-actions">${btn('⋯','guide','aria-label="玩法与设置" class="td-icon"')}${btn('⛶','focus','aria-label="进入专注模式" class="td-icon td-focus-toggle"')}</div></header><div class="td-layout"><div class="td-battle-column"><nav class="td-islands" aria-label="共享地图与玩家防区"></nav><div class="td-board-surface"><div class="td-canvas"></div><div class="td-pad-controls" aria-label="防区建造位"></div><div class="td-scene-note" aria-live="polite"></div></div></div><aside class="td-management" aria-label="防区操作"><div class="td-control-bar"><div class="td-wallet"></div><div class="td-skills"></div></div><nav class="td-tabs" aria-label="建造与经营">${btn('建造','tab','data-tab="build"')}${btn('港口','tab','data-tab="economy"')}${btn('遗物','tab','data-tab="growth"')}</nav><div class="td-panel"></div><div class="td-error" role="alert"></div></aside></div><div class="td-bottom"></div><div class="td-modal-host"></div></section>`;
  root=el.querySelector('.td-game');
  const pads=root!.querySelector('.td-pad-controls')!;
  for(const p of PADS){const button=document.createElement('button');button.type='button';button.className='td-pad-hit';button.dataset.action='game:pad';button.dataset.pad=String(p.id);button.style.left=`${p.x/800*100}%`;button.style.top=`${p.y/640*100}%`;button.setAttribute('aria-label',`建造位 ${p.id+1}`);pads.append(button);}
  battle=mountBattle(root!.querySelector('.td-canvas')!,d=>{if(aiming)void command({type:'skill',skill:aiming,sector,d});},k=>audio.play(k));
  el.addEventListener('keydown',keyboard);
 }
 function paint(){
  if(!root||!room?.game)return;const s=room.game,p=me(),own=owner(),self=s.self;if(!p)return;
  const t=selected===null?null:ownTower(),locked=busy||!!room.dissolution||s.phase==='finished',count=s.enemies.length;
  root.classList.toggle('td-danger',count/s.cap>=.8);root.classList.toggle('td-aiming',!!aiming);
  root.classList.toggle('td-focused',focused);root.classList.toggle('td-finished',s.phase==='finished');
  root.querySelector('.td-focus-toggle')!.setAttribute('aria-label',focused?'返回平台视图':'进入专注模式');
  root.querySelector('.td-focus-toggle')!.textContent=focused?'↙':'⛶';
  const seconds=Math.max(0,Math.ceil((s.phaseUntil-s.time)/1000));
  const phase=s.phase==='prepare'?btn(`${p.ready?'✓':'▶'} ${seconds}s`,'ready',`class="td-ready" aria-label="${p.ready?'已准备':'提前迎战'}"`,locked||p.ready):`<span class="td-countdown">${s.phase==='finished'?'结束':s.wave===18?'清场':seconds+'s'}</span>`;
  setHTML('.td-status',`${btn(`<strong>${s.wave}</strong><small>/18 波</small>`,'waveInfo','class="td-wave-number" aria-label="查看当前波次"')}<div class="td-pressure" aria-label="全图怪物 ${count}，上限 ${s.cap}">${art('slime')}<strong>${count}<small>/${s.cap}</small></strong><progress value="${count}" max="${s.cap}" aria-label="全图怪物数量"></progress></div><div class="td-phase">${phase}</div>`);
  setHTML('.td-islands',s.players.map((q:any,i:number)=>{const threats=s.enemies.filter((m:any)=>m.sector===q.sector).length;return `${i?'<span class="td-flow" aria-hidden="true">›</span>':''}${btn(`<b>${q.id===user.id?'我的岛':e(name(q.id))}</b><span class="td-threats">${threats}</span>`,'sector',`data-sector="${q.sector}" class="td-island ${sector===q.sector?'is-selected':''} ${threats>s.cap/s.players.length*.8?'is-crowded':''}" aria-label="${e(name(q.id))}的防区，${threats} 只怪物" aria-pressed="${sector===q.sector}"`)}`;}).join('')+'<span class="td-loop" aria-label="环形航线">↻</span>');
  const preview=selected!==null&&!t&&tab==='build'&&mine()?kind:null;battle?.scene.setView(s,sector,selected,preview,aiming);
  for(const button of root.querySelectorAll<HTMLButtonElement>('.td-pad-hit')){const pad=Number(button.dataset.pad),tower=s.towers.find((q:any)=>q.sector===sector&&q.pad===pad);button.setAttribute('aria-label',tower?`${TOWERS[tower.kind].name}，${tower.level} 阶，建造位 ${pad+1}`:`空建造位 ${pad+1}`);button.setAttribute('aria-pressed',String(pad===selected));}
  setHTML('.td-scene-note',aiming?`<span>选择落点</span>${btn('×','cancelAim','aria-label="取消技能"')}`:'');
  setHTML('.td-skills',Object.entries(SKILLS).map(([id,skill]:[string,any])=>{const remaining=Math.max(0,Math.ceil((self.skillReady[id]-s.time)/1000));return btn(`<span class="td-skill-symbol">${id==='meteor'?'✦':'❄'}</span><b>${remaining?remaining+'s':id==='meteor'?'轰击':'减速'}</b>`,'skill',`data-skill="${id}" class="td-skill ${id}" aria-label="${skill.name}${remaining?'，冷却 '+remaining+' 秒':''}" aria-pressed="${aiming===id}"`,locked||remaining>0||s.phase==='prepare'&&!s.enemies.length);}).join(''));
  setHTML('.td-wallet',`<strong>${coin(p.gold)}</strong><small>+${n(p.income)}/波</small>`);
  for(const b of root.querySelectorAll<HTMLButtonElement>('.td-tabs button')){b.setAttribute('aria-selected',String(b.dataset.tab===tab));if(b.dataset.tab==='growth'){const label=`遗物${self.offers.length?' · '+self.offers.length:''}`;if(b.textContent!==label)b.textContent=label;b.classList.toggle('has-offer',!!self.offers.length);}}
  let panel='';
  if(tab==='build'){
   if(t){const definition=TOWERS[t.kind],stats=towerStats(t,own),upgrade=costFor(t.kind,t.level+1,p),canUpgrade=t.level<4&&(t.level<3||s.wave>=10);
    panel=`<div class="td-selected-tower">${art(t.kind)}<div><h2>${e(t.branch?definition.branches.find((b:any)=>b.id===t.branch)?.name:definition.short)}</h2><small class="td-level">${'◆'.repeat(t.level)}</small></div>${btn('ⓘ','towerInfo',`data-kind="${t.kind}" class="td-icon" aria-label="建筑说明"`)}${btn('×','clear','class="td-icon" aria-label="取消选择"')}</div><div class="td-stat-pills">${stats.damage?`<span>伤害 <b>${Math.round(stats.damage)}</b></span><span>射程 <b>${Math.round(stats.range)}</b></span>`:`<span>收入 <b>+${stats.income}/波</b></span>`}</div>`;
    if(mine()){
     if(t.level===2)panel+=`<div class="td-branches">${definition.branches.map((b:any)=>btn(`<b>${b.name}</b><span>${b.text}</span>${coin(upgrade)}`,'upgrade',`data-tower="${t.id}" data-branch="${b.id}"`,locked||p.gold<upgrade)).join('')}</div>`;
     else if(t.level<4)panel+=btn(t.level===3&&s.wave<10?'第 10 波解锁':`升级 ${coin(upgrade)}`,'upgrade',`data-tower="${t.id}" class="td-primary td-wide"`,locked||!canUpgrade||p.gold<upgrade);
     panel+=btn(more?'收起 ⌃':'攻击 / 拆除 ⌄','more',`class="td-more-toggle" aria-expanded="${more}"`);
     if(more){if(t.kind!=='market')panel+=`<div class="td-target">${[['first','最前'],['strong','最强'],['healer','治疗']].map(([value,label])=>btn(label,'target',`data-tower="${t.id}" data-target="${value}" aria-label="优先攻击${label}" aria-pressed="${t.target===value}"`,locked)).join('')}</div>`;
      panel+=confirmSell?`<div class="td-sell-confirm">${btn('取消','cancelSell')}${btn(`确认拆除 +${Math.floor(t.spent*7/10)}`,'sell',`data-tower="${t.id}"`,locked)}</div>`:btn(`拆除 +${Math.floor(t.spent*7/10)}`,'confirmSell','class="td-sell"',locked);}
    }
   }else if(!mine())panel=`<div class="td-ally"><span>◈</span><b>${e(name(own.id))}</b>${btn('↙ 我的岛','home')}</div>`;
   else {panel=`<div class="td-catalog">${Object.entries(TOWERS).map(([id,t]:[string,any])=>btn(`${art(id)}<b>${t.short}</b><small>${coin(costFor(id,1,p))}</small>`,'choose',`data-kind="${id}" class="${kind===id?'is-selected':''}" aria-label="选择${t.name}" aria-pressed="${kind===id}"`)).join('')}</div><div class="td-build-summary"><b>${TOWERS[kind].short}</b><span>${TOWERS[kind].role}</span>${btn('ⓘ','towerInfo',`data-kind="${kind}" class="td-icon" aria-label="建筑说明"`)}</div>`;
    if(selected!==null)panel+=`<div class="td-build-commit">${btn('×','clear','class="td-icon" aria-label="取消选择"')}${btn(`建造 ${coin(costFor(kind,1,p))}`,'build',`class="td-primary td-wide" aria-label="建造${TOWERS[kind].short}"`,locked||p.gold<costFor(kind,1,p))}</div>`;}
  }else if(tab==='economy'){
   const markets=s.towers.filter((t:any)=>t.owner===user.id&&t.kind==='market'),interest=Math.min(p.relics.includes('interest')?25:15,Math.floor(p.gold*.05));
   panel=`<div class="td-economy-hero">${art('market')}<div><h2>港口 <small>${p.harbor}/4</small></h2><p>+${p.harbor*14}/波</p></div></div>${p.harbor<4?btn(`扩建 ${coin(harborCost(p.harbor))}`,'harbor','class="td-primary td-wide"',locked||p.gold<harborCost(p.harbor)):''}<div class="td-economy-summary"><span><b>${markets.length}/3</b>渔市</span><span><b>+${interest}</b>利息</span><span><b>+14/波</b>扩建收益</span></div>`;
  }else{
   const offer=self.offers[0];
   panel=offer?`<div class="td-relic-choices">${offer.choices.map((id:string)=>btn(`<span>✧</span><div><b>${RELICS[id].name}</b><small>${RELICS[id].text}</small></div>`,'relic',`data-relic="${id}"`,locked)).join('')}</div>`:'';
   panel+=`<div class="td-owned-relics">${[0,1,2].map(i=>{const id=p.relics[i];return id?btn(`<span>✧</span><b>${RELICS[id].name}</b>`,'relicInfo',`data-relic="${id}" aria-label="查看${RELICS[id].name}"`):`<span class="td-relic-slot"><i>◇</i><small>${[5,10,15][i]} 波</small></span>`;}).join('')}</div>`;
  }
  setHTML('.td-panel',panel);setHTML('.td-error',error?e(error):'');setHTML('.td-bottom',s.phase==='finished'?results():'');
  if(modal&&!root.querySelector('dialog'))openModal();
  const audioButton=root.querySelector<HTMLButtonElement>('[data-action="game:audio"]');if(audioButton){audioButton.setAttribute('aria-pressed',String(audio.enabled));audioButton.textContent=audio.enabled?'♫ 音效开':'♫ 音效关';}
 }
 function openModal(){
  const s=room.game;let content='';
  if(modal==='guide')content=guide();
  else if(modal==='wave')content=`<div class="td-info">${art(s.waveInfo.boss?'boss':s.waveInfo.kind)}<h2>第 ${s.wave} 波 · ${e(s.waveInfo.name)}</h2><p>${e(s.waveInfo.hint)}</p><p>全图 ${s.enemies.length}/${s.cap} 只怪物。超过上限时全队失败。</p>${s.wave===18?`<p>清空全部敌人即可获胜。援军倒计时 ${Math.max(0,Math.ceil((s.phaseUntil+120000+(s.finalReinforcements??0)*10000-s.time)/1000))} 秒，下一批每岛 ${5*2**Math.min(s.finalReinforcements??0,6)} 只；后续每 10 秒翻倍，单批每岛最多 320 只。</p>`:''}</div>`;
  else if(modal.startsWith('tower:')){const id=modal.slice(6),t=TOWERS[id];content=`<div class="td-info">${art(id)}<h2>${t.name}</h2><p>${t.description}</p>${t.branches.map((b:any)=>`<p><b>${b.name}</b><br>${b.text}</p>`).join('')}</div>`;}
  else {const r=RELICS[modal.slice(6)];content=`<div class="td-info"><h2>✧ ${r.name}</h2><p>${r.text}</p></div>`;}
  const host=root!.querySelector('.td-modal-host')!;host.innerHTML=`<dialog class="td-dialog"><div class="td-dialog-close">${modal==='guide'?btn(audio.enabled?'♫ 音效开':'♫ 音效关','audio',`class="td-guide-audio" aria-pressed="${audio.enabled}"`):''}${btn('×','closeGuide','class="td-icon" aria-label="关闭说明"')}</div>${content}</dialog>`;
  const dialog=host.querySelector('dialog')!;dialog.addEventListener('cancel',event=>{event.preventDefault();closeModal();});dialog.showModal();
 }
 function results(){const s=room.game;return `<section class="td-results"><span class="td-result-symbol">${s.won?'★'.repeat(s.rating??1)+'☆'.repeat(3-(s.rating??1)):'◈'}</span><h2>${s.won?'守岛成功':'远航结束'}</h2><p>${s.wave} 波 · ${n(s.totalKills)} 击杀 · 峰值 ${s.peak}/${s.cap}</p><div class="td-result-players">${s.players.map((p:any)=>`<article><h3>${e(name(p.id))}</h3><strong>${n(p.stats.kills)} <small>击杀</small></strong><p>${p.stats.rescues} 救援 · ${s.towers.filter((t:any)=>t.owner===p.id).length} 建筑</p><div>${p.achievements.map((a:string)=>`<span>✧ ${a}</span>`).join('')}</div></article>`).join('')}</div>${resultActions(room,user)}</section>`;}
 function closeModal(){modal='';root?.querySelector('dialog')?.close();root?.querySelector('.td-modal-host')?.replaceChildren();root?.querySelector<HTMLButtonElement>('[data-action="game:guide"]')?.focus();}
 async function command(c:any){if(busy||room.dissolution||room.game.phase==='finished')return;busy=true;error='';paint();try{await send(c);if(c.type==='skill')aiming=null;if(c.type==='sell'){confirmSell=false;selected=null;more=false;}}catch(err:any){error=err.message;}finally{busy=false;paint();}}
 function keyboard(event:KeyboardEvent){if((event.target as HTMLElement).matches('input,textarea,select'))return;if(event.key==='Escape'){aiming=null;confirmSell=false;if(modal)closeModal();else{selected=null;paint();}}if(!modal&&/^[1-6]$/.test(event.key)){kind=Object.keys(TOWERS)[Number(event.key)-1];tab='build';paint();}}
 return {update(el:HTMLElement,snapshot:any,currentUser:any){room=snapshot;user=currentUser;if(!room.game)return;if(lastMatch!==room.matchId){lastMatch=room.matchId;sector=room.game.self?.sector??0;selected=null;aiming=null;tab='build';error='';modal='';more=false;confirmSell=false;battle?.destroy();battle=null;root?.querySelector('dialog')?.close();root=null;htmlCache.clear();}if(!root||!el.contains(root))mount(el);paint();},
 async handle(action:string,target:HTMLElement){if(!room?.game)return;
  if(action==='audio'){audio.toggle();paint();return;}if(action==='guide'){modal='guide';paint();return;}if(action==='closeGuide'){closeModal();return;}
  if(action==='waveInfo'||action==='towerInfo'||action==='relicInfo'){modal=action==='waveInfo'?'wave':action==='towerInfo'?'tower:'+target.dataset.kind:'relic:'+target.dataset.relic;paint();return;}
  if(action==='focus'){focused=!focused;paint();return;}
  if(action==='sector'||action==='home'){sector=action==='home'?room.game.self.sector:Number(target.dataset.sector);selected=null;confirmSell=false;more=false;paint();return;}
  if(action==='pad'){selected=Number(target.dataset.pad);tab='build';confirmSell=false;more=false;paint();return;}
  if(action==='clear'){selected=null;confirmSell=false;more=false;paint();return;}
  if(action==='choose'){kind=target.dataset.kind!;paint();return;}
  if(action==='tab'){tab=target.dataset.tab!;paint();return;}
  if(action==='more'){more=!more;paint();return;}
  if(action==='cancelAim'){aiming=null;paint();return;}
  if(action==='confirmSell'){confirmSell=true;paint();return;}if(action==='cancelSell'){confirmSell=false;paint();return;}
  if(action==='skill'){if(target.dataset.skill==='meteor'){aiming='meteor';selected=null;paint();return;}return command({type:'skill',skill:'freeze',sector});}
  if(action==='build'&&selected!==null)return command({type:'build',kind,pad:selected});
  if(action==='upgrade')return command({type:'upgrade',tower:Number(target.dataset.tower),branch:target.dataset.branch});
  if(action==='sell')return command({type:'sell',tower:Number(target.dataset.tower)});
  if(action==='target')return command({type:'target',tower:Number(target.dataset.tower),target:target.dataset.target});
  if(action==='ready'||action==='harbor')return command({type:action});
  if(action==='relic')return command({type:'relic',relic:target.dataset.relic});
 },beforeOverlay(){},afterOverlay(){},dispose(){container?.removeEventListener('keydown',keyboard);root?.querySelector('dialog')?.close();battle?.destroy();battle=null;audio.dispose();root=null;container=null;htmlCache.clear();lastMatch='';}};
}

