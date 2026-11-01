import {createRoomConnection} from './room-connection.js';
import {escapeHtml as e} from './ui.js';
import {loadStyles} from './styles-loader.js';
import {icon} from './icons.js';
import {playerAvatar,playerName} from './player-identity.js';
import {actorId,name,phaseText,progressText,playerStats} from './games/spectator-ui.js';

const styles={
 'the-gang':['/games/the-gang/style.css'],
  dnup:['/games/dnup/style.css'],
  scram:['/games/scram/style.css'],
  tidewatch:['/games/tidewatch/style.css'],
  cabo:['/games/cabo/call-effect.css','/games/cabo/mobile.css'],
  uno:['/games/uno/style.css'],marrakech:['/games/marrakech/style.css'],
  catan:['/games/catan/style.css'],
  'texas-holdem':['/games/texas-holdem/style.css'],
  'seven-wonders':['/games/seven-wonders/atlas.css','/games/seven-wonders/expansions.css'],
  'night-of-the-ninja':['/games/night-of-the-ninja/style.css'],
  dnd:['/games/dnd/art.css'],
};
const views={cabo:()=>import('./games/cabo/spectator.js'),uno:()=>import('./games/uno/spectator.js'),marrakech:()=>import('./games/marrakech/spectator.js'),catan:()=>import('./games/catan/spectator.js'),'texas-holdem':()=>import('./games/texas-holdem/spectator.js'),'seven-wonders':()=>import('./games/seven-wonders/spectator.js'),'night-of-the-ninja':()=>import('./games/night-of-the-ninja/spectator.js'),dnd:()=>import('./games/dnd/spectator.js')};
const eventLabels={play:'出牌',draw:'抽牌',pass:'结束回合',color:'选择颜色',uno:'喊出 UNO',catch:'抓到漏喊',accept:'接受罚抽',challengeWon:'质疑成功',challengeLost:'质疑失败',fold:'弃牌',check:'过牌',call:'跟注',raise:'加注',allIn:'全押',deal:'开始发牌',flop:'发出翻牌',turn:'发出转牌',river:'发出河牌',showdown:'摊牌结算',uncontested:'本手结束',refund:'退回筹码',build:'建造',roll:'掷骰',end:'结束回合',buy:'购买发展卡',offer:'提出交易',cancelOffer:'撤回交易',discard:'弃牌',robber:'移动强盗',steal:'抢夺资源',bank:'银行兑换',attack:'发起攻击',ability:'使用技能',reaction:'作出反应',place:'铺下地毯',move:'商人前进',start:'对局开始'};
views.tidewatch=()=>import('./games/tidewatch/spectator.js');
views.scram=()=>import('./games/scram/spectator.js');
views['the-gang']=()=>import('./games/the-gang/spectator.js');
views.dnup=()=>import('./games/dnup/spectator.js');
export function publicActivity(room){
  const s=room.game;if(!s)return [];
  if(typeof s.lastAction==='string')return [s.lastAction];
  if(s.journal?.length)return s.journal.slice(-4).reverse().map(entry=>entry.text.length>110?entry.text.slice(0,110)+'…':entry.text);
  const source=s.log?.length?s.log:s.lastActions?.length?s.lastActions:s.lastEvent?[s.lastEvent]:[];
  return source.slice(-6).reverse().map(entry=>{
    const id=entry.actorId??entry.actor??entry.id??entry.playerId,label=eventLabels[entry.type??entry.action]??'完成公开行动';
    const amount=typeof entry.amount==='number'?` · ${entry.amount}`:entry.dice?` · ${entry.dice.join(' + ')}`:entry.die?` · ${entry.die} 格`:'';
    return `${id?name(room,id)+' · ':''}${label}${amount}`;
  });
}
export function spectatorRoster(room,focusId=null){
  const playing=room.game?.players??room.players,active=actorId(room);
  return playing.map((p,index)=>`<button type="button" class="spectator-roster-player ${active===p.id?'is-active':''}" data-action="spectator:focus" data-player="${e(p.id)}" aria-pressed="${focusId===p.id}"><span class="spectator-seat-number">${String(index+1).padStart(2,'0')}</span>${playerAvatar(room,p.id)}<span class="spectator-roster-identity"><b>${playerName(room,p.id)}</b><small>${e(room.game?playerStats(room,p):p.ready?'已准备':'等待准备')}</small></span><span class="spectator-roster-signal">${active===p.id?'行动中':room.game?.winners?.includes(p.id)||room.game?.winner===p.id?'♛':room.players.find(q=>q.id===p.id)?.isBot?'AI':''}</span></button>`).join('');
}
export function createSpectator({root,shell,user,snapshot}) {
  let current=snapshot,renderGame,liveRenderer,disposed=false,ended=false,focusId=null,wide=false,loading=false,loadError=false;
  shell.show(`<main class="spectator-page"><div class="spectator-heading"><div class="spectator-heading-title"><span class="spectator-eyebrow">${icon('room')} MOON TABLE <i>/</i> 观战台</span><h1>${e(snapshot.title)}</h1><p>${e(snapshot.gameTitle)}<span>房间 ${e(snapshot.id)}</span></p></div><div class="spectator-heading-actions"><span class="spectator-live" data-state="connecting"><i></i><span id="spectator-status" role="status">正在连接</span></span><button type="button" class="outline-button" data-action="stop-watching">${icon('chevron')}退出观战</button></div></div><div class="spectator-toolbar"><div class="spectator-perspective"><span class="spectator-public-mark">${icon('people')}公开视角</span><span class="spectator-toolbar-divider"></span><button type="button" data-action="spectator:overview" aria-pressed="true">全桌总览</button><span id="spectator-focus-label">点击玩家，关注场上动态</span></div><button type="button" class="spectator-wide-button" data-action="spectator:wide" aria-pressed="false">${icon('room')}展开牌桌</button></div><div class="spectator-layout"><section class="spectator-main" aria-label="观战牌桌"><div class="spectator-table-top"><span><i></i><b id="spectator-phase"></b></span><small id="spectator-progress"></small></div><div id="spectator-content" aria-busy="true"></div><div class="spectator-table-footer"><span>◈ 仅展示公开信息 · 私密内容保持隐藏</span><span id="spectator-sync">等待同步</span></div></section><aside class="spectator-sidebar" aria-label="对局信息"><section class="spectator-roster"><div class="spectator-panel-heading"><h2>同桌玩家</h2><span id="spectator-player-count"></span></div><div id="spectator-players"></div></section><section class="spectator-activity"><div class="spectator-panel-heading"><h2>牌桌动态</h2>${icon('chart')}</div><div id="spectator-activity"></div></section><details class="spectator-info"><summary>关于公开观战${icon('chevron')}</summary><p>这里与游戏内共享牌桌、棋盘和公开状态。选择玩家可以调整观察位置，或突出该玩家的公开区域。</p><p>切换观察位置不会展示任何人的私人手牌、身份或笔记。已公开的牌面与结算会随对局同步。</p></details></aside></div></main>`,user,'my-room');
  const page=root.querySelector('.spectator-page'),area=page.querySelector('#spectator-content'),status=page.querySelector('#spectator-status');
  const setStatus=(value,text)=>{if(disposed)return;status.textContent=text;page.querySelector('.spectator-live').dataset.state=value;};
  function draw(){
    if(disposed||ended)return;
    if(!current.game)liveRenderer?.dispose();
    const active=document.activeElement,focusAction=page.contains(active)?active?.dataset.action:null,focusPlayer=active?.dataset.player;
    const scroll=area.querySelector('.spectator-journal')?.scrollTop;
    const guide=area.querySelector('.mk-guide-dialog'),guideOpen=!!guide?.open,guideScroll=guide?.scrollTop??0;
    const opened=[...area.querySelectorAll('details')].flatMap((el,index)=>el.open?[index]:[]);
    area.setAttribute('aria-busy',String(loading));
    if(loadError)area.innerHTML='<section class="spectator-wait"><span class="spectator-wait-symbol">☾</span><h2>牌桌暂时未能载入</h2><p>可以重新加载，实时连接会继续保持。</p><button type="button" data-action="spectator:retry">重新加载牌桌</button></section>';
    else if(current.game&&liveRenderer)liveRenderer.update(area,current,{focusId});
    else if(current.game&&renderGame)area.innerHTML=renderGame(current,{focusId});
    else area.innerHTML=`<section class="spectator-wait"><span class="spectator-wait-symbol">☾</span><small>${current.game?'PREPARING THE TABLE':'THE TABLE IS GATHERING'}</small><h2>${current.game?'正在铺好牌桌…':'等待好戏开场'}</h2><p>${current.game?'即将进入完整牌桌视角':'玩家正在入座，开局后会自动切换到牌桌。'}</p><div class="spectator-wait-avatars">${current.players.map(p=>playerAvatar(current,p.id)).join('')}</div></section>`;
    page.querySelector('#spectator-phase').textContent=phaseText(current);
    page.querySelector('#spectator-progress').textContent=progressText(current);
    page.querySelector('#spectator-players').innerHTML=spectatorRoster(current,focusId);
    page.querySelector('#spectator-player-count').textContent=`${current.players.length} 位`;
    const activity=publicActivity(current);
    page.querySelector('#spectator-activity').innerHTML=activity.length?`<ol>${activity.map(text=>`<li><i></i><p>${e(text)}</p></li>`).join('')}</ol>`:'<p class="spectator-activity-empty">新的公开行动会显示在这里</p>';
    page.querySelector('#spectator-focus-label').textContent=focusId?`正在关注 ${name(current,focusId)} · 仅公开信息`:'点击玩家，关注场上动态';
    page.querySelector('[data-action="spectator:overview"]').setAttribute('aria-pressed',String(!focusId));
    area.querySelectorAll('[data-player-id],.table-seat[data-player]').forEach(el=>el.classList.toggle('spectator-focused',!!focusId&&(el.dataset.playerId??el.dataset.player)===focusId));
    const details=area.querySelectorAll('details');opened.forEach(index=>{if(details[index])details[index].open=true;});
    if(guideOpen){const dialog=area.querySelector('.mk-guide-dialog');if(dialog){dialog.showModal();dialog.scrollTop=guideScroll;if(guide?.contains(active))dialog.querySelector('button')?.focus({preventScroll:true});}}
    if(scroll!==undefined){const journal=area.querySelector('.spectator-journal');if(journal)journal.scrollTop=scroll;}
    if(focusAction==='spectator:focus')Array.from(page.querySelectorAll('[data-action="spectator:focus"]')).find(el=>el.dataset.player===focusPlayer)?.focus({preventScroll:true});
  }
  async function load(){
    if(loading||disposed||ended)return;loading=true;loadError=false;draw();
    try{
      if(!/^[a-z][a-z0-9-]*$/.test(current.gameId))throw new Error('Unknown game');
      const loadView=views[current.gameId]??(()=>import(`./games/${current.gameId}/spectator.js`));
      const [module]=await Promise.all([loadView(),loadStyles([...(styles[current.gameId]??[]),'/spectator.css'])]);
      if(disposed||ended)return;renderGame=module.render;
      if(module.createRenderer){const instance=await module.createRenderer();if(disposed||ended){instance.dispose();return;}liveRenderer=instance;}
    }catch{loadError=true;}finally{loading=false;draw();}
  }
  function click(event){
    const target=event.target.closest('[data-action]');if(!target||!page.contains(target))return;
    const action=target.dataset.action;
    // Observers own local presentation actions only; never pass game commands to the room handler.
    if(action.startsWith('game:')){
      event.preventDefault();event.stopPropagation();
      if(action==='game:guide-open')area.querySelector('.mk-guide-dialog')?.showModal();
      if(action==='game:guide-close')area.querySelector('.mk-guide-dialog')?.close();
      return;
    }
    if(!action.startsWith('spectator:'))return;
    event.preventDefault();event.stopPropagation();
    if(action==='spectator:focus'){focusId=current.players.some(p=>p.id===target.dataset.player)?target.dataset.player:null;draw();}
    if(action==='spectator:overview'){focusId=null;draw();}
    if(action==='spectator:wide'){wide=!wide;page.classList.toggle('spectator-wide',wide);target.setAttribute('aria-pressed',String(wide));target.innerHTML=`${icon('room')}${wide?'显示对局信息':'展开牌桌'}`;}
    if(action==='spectator:retry')void load();
  }
  page.addEventListener('click',click);
  void load();
  const connection=createRoomConnection({id:current.id,spectator:true,socket:current.realtime===true,receive(next){
    if(next.left){liveRenderer?.dispose();ended=true;setStatus('ended','观战已结束');page.querySelector('#spectator-phase').textContent='房间已关闭或房主已关闭观战';area.setAttribute('aria-busy','false');area.innerHTML='<section class="spectator-wait"><span class="spectator-wait-symbol">☾</span><h2>本次观战已结束</h2><p>可以返回房间列表，寻找下一张牌桌。</p><button type="button" data-action="stop-watching">浏览其他房间</button></section>';page.querySelector('.spectator-table-footer').hidden=true;page.querySelectorAll('.spectator-roster-player').forEach(el=>el.classList.remove('is-active'));page.querySelectorAll('.spectator-roster-signal').forEach(el=>{el.textContent='';});connection.close();return;}
    if(next.revision<current.revision)return;
    current=next;if(focusId&&!current.players.some(p=>p.id===focusId))focusId=null;draw();
    page.querySelector('#spectator-sync').textContent=`已同步 ${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`;
  },status(value){if(!disposed&&!ended)setStatus(value,({connected:'实时同步',syncing:'正在同步',expired:'登录已失效',offline:'网络已断开',reconnecting:'正在重连'})[value]??'正在连接');}});
  return {dispose(){disposed=true;liveRenderer?.dispose();page.removeEventListener('click',click);connection.close();area.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());}};
}
