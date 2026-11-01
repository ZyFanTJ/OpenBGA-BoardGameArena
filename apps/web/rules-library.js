import {escapeHtml as e} from './ui.js';
import {setupIcon} from './room-setup.js';
import {loadStyles} from './styles-loader.js';
import {pregameGuide} from './games/pregame-guide.js';

/** Browse game-owned public rules without creating a room or a player session. */
export async function openRulesLibrary(root,games,metadata){
 await loadStyles(['/rules-library.css']);
 root.querySelector('#rules-library-dialog')?.remove();
 const available=games.filter(g=>g.enabled!==false),opener=document.activeElement;
 const dialog=document.createElement('dialog');
 dialog.id='rules-library-dialog';dialog.className='rules-library';dialog.setAttribute('aria-labelledby','rules-library-title');
 dialog.innerHTML=`<header class="rules-library-heading"><div>${setupIcon('book-open')}<h2 id="rules-library-title">玩法手卡</h2></div><button type="button" class="rules-library-close" aria-label="关闭玩法手卡" autofocus>${setupIcon('x')}</button></header><div class="rules-library-layout"><nav class="rules-library-games" aria-label="选择查看玩法的游戏">${available.map(g=>{const m=metadata[g.id]??{};return `<button type="button" class="rules-library-game" data-rules-game="${e(g.id)}" aria-pressed="false" aria-controls="rules-library-reader"><span class="game-cover ${e(m.coverClass??'')}" aria-hidden="true">${m.artHtml??''}</span><span><b>${e(g.title)}</b><small>${g.minPlayers}–${g.maxPlayers} 人 · ${e(m.duration??'')} 分钟</small></span></button>`;}).join('')}</nav><article id="rules-library-reader" class="rules-library-reader" aria-label="游戏玩法手卡" tabindex="0"><div class="rules-library-game-heading"><h3></h3></div><div class="pregame-guide-body rules-library-content"></div></article></div>`;
 root.append(dialog);
 const reader=dialog.querySelector('.rules-library-reader'),content=dialog.querySelector('.rules-library-content');
 let request=0;
 async function select(id){
  const game=available.find(g=>g.id===id);if(!game)return;
  const current=++request;
  dialog.querySelectorAll('[data-rules-game]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.rulesGame===id)));
  dialog.querySelector('.rules-library-game-heading h3').textContent=game.title;
  reader.setAttribute('aria-label',`${game.title} · 玩法手卡`);reader.scrollTop=0;
  content.setAttribute('aria-busy','true');content.innerHTML='<p role="status">正在加载…</p>';
  try{
   const html=await pregameGuide(id);
   if(current===request&&dialog.open){
    const template=document.createElement('template');template.innerHTML=html;
    // The library already names the game. Keep rule text, editions and attribution intact.
    template.content.querySelectorAll('.reference-heading,.uno-guide>h2,.uno-guide>small,.nn-reference>h2,.nn-reference>small,.sw-rules-scope').forEach(node=>node.remove());
    template.content.querySelectorAll('details.ct-guide,details.dnd-guide').forEach(node=>{
     node.querySelector(':scope>summary')?.remove();node.replaceWith(...node.childNodes);
    });
    if(id==='cabo'){
     template.content.querySelector('.reference-goal b').textContent='累计罚分最低的人获胜。';
     template.content.querySelector('.reference-goal span').textContent='开局查看自己的 2 张牌，记住后盖回。';
     template.content.querySelectorAll('.reference-power h3').forEach((heading,index)=>{heading.innerHTML=`<b>${['7 / 8','9 / 10','11 / 12'][index]}</b>`;});
     template.content.querySelector('.reference-call h3').textContent='呼叫 CABO';
     template.content.querySelector('.reference-call p').textContent='本回合不抽牌，其他玩家各再行动一次。你的分数最低或并列最低时，这轮记 0 分；否则加 10 分。';
     template.content.querySelector('.reference-special span').textContent='Kamikaze 组合让自己记 0 分，其他人各记 50 分。';
     template.content.querySelector('.rg-edition').textContent='2019 英文第二版';
     const note=template.content.querySelector('.rg-note');note.textContent=note.textContent.replace('标准模式：','标准模式下，');
    }
    if(id==='marrakech'){
     const sections=template.content.querySelectorAll('.rg-section'),pair=document.createElement('div');pair.className='rules-library-pair';
     sections[1].before(pair);pair.append(sections[1],sections[2]);
    }
    content.replaceChildren(template.content);
   }
  }catch{
   if(current===request&&dialog.open)content.innerHTML='<p role="alert">加载失败，请重新选择游戏重试。</p>';
  }finally{if(current===request)content.removeAttribute('aria-busy');}
 }
 dialog.querySelector('.rules-library-close').addEventListener('click',()=>dialog.close());
 dialog.querySelector('.rules-library-games').addEventListener('click',event=>{
  const button=event.target.closest('[data-rules-game]');if(button)void select(button.dataset.rulesGame);
 });
 dialog.addEventListener('close',()=>{request++;dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});},{once:true});
 dialog.showModal();
 if(available.length)await select(available[0].id);
 else content.textContent='暂无开放的桌游。';
}
