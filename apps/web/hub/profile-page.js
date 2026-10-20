import {escapeHtml as e} from '../ui.js';
import {icon} from '../icons.js';
import {avatar,bannerClass,itemArt} from './cosmetics.js';
import {gameCards} from '../games/registry.js';

const action=(label,name,attrs='')=>`<button type="button" data-action="hub:${name}" ${attrs}>${label}</button>`;
const title=(user,items)=>items.find(item=>item.id===user.appearance.title)?.name??'初来乍到';
const date=value=>value?new Date(value).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}):'历史存档';
const presence={online:'当前在线',lobby:'等待同桌',playing:'正在对局',offline:'当前离线'};
const pct=(wins,played)=>played?Math.round(wins/played*100)+'%':'—';
const heading=(name,control='')=>`<div class="pp-section-heading"><h2>${name}</h2>${control}</div>`;
const art=(id)=>`<div class="game-cover ${e(gameCards[id]?.coverClass??'')}" aria-hidden="true">${gameCards[id]?.artHtml??''}</div>`;

export function profileIdentity(user,items,status='online'){
  const details=user.details??{};
  return `<div class="pp-identity">${avatar(user,'pp-avatar')}<div class="pp-identity-copy"><span class="pp-title">${e(title(user,items))}</span><h1>${e(user.name)}</h1><div class="pp-identity-meta"><span class="pp-presence ${status==='offline'?'is-offline':''}"><i></i>${presence[status]??presence.online}</span><span>${new Date(user.createdAt).getFullYear()} 年加入</span></div>${details.bio?`<p class="pp-bio">${e(details.bio)}</p>`:''}</div></div>`;
}

export function renderProfilePage(data,items,games){
  const {profile:user,summary,owner,badges}=data,details=user.details??{};
  const favorite=summary.perGame.find(game=>game.id===details.favoriteGame)
    ??[...summary.perGame].filter(game=>game.played).sort((a,b)=>b.played-a.played)[0];
  const showcase=(details.showcase??[]).map(id=>items.find(item=>item.id===id)).filter(Boolean);
  const earned=badges.filter(badge=>badge.earned).length;
  return `<div class="pp-backdrop ${bannerClass(user.appearance.banner)}" aria-hidden="true"></div><div class="pp-sheet">
    <section class="pp-hero ${bannerClass(user.appearance.banner)}">${profileIdentity(user,items,data.status)}<div class="pp-hero-actions">${owner?action('编辑个人资料','edit-profile','class="hub-primary"'):action('返回我的资料','own-profile','class="hub-secondary"')}${owner?action(icon('copy')+'好友码','copy-code','class="hub-secondary"'):action('邀请同桌','invite-friend',`class="hub-primary" data-id="${e(user.id)}"`)}</div></section>
    <div class="pp-layout"><div class="pp-main">
      <section aria-label="对局概览"><div class="pp-overview"><div><b>${summary.played}</b><span>完成对局</span></div><div><b>${summary.wins}</b><span>胜场</span></div><div><b>${pct(summary.wins,summary.played)}</b><span>胜率</span></div><div><b>${data.collectionCount}</b><span>藏品</span></div></div><div class="pp-mode-summary"><span>真人 ${summary.played-summary.practice}</span><span>AI 练习 ${summary.practice}</span></div></section>
      <section class="pp-panel pp-badges">${heading('旅程徽章',`<span>${earned} / ${badges.length}</span>`)}<div class="pp-badge-grid">${badges.map(badge=>action(`<span class="pp-badge-emblem">${icon(badge.icon)}</span><b>${e(badge.name)}</b><span>${badge.earned?'已解锁':`${badge.current} / ${badge.target}`}</span>`,'badge',`class="pp-badge ${badge.earned?'is-earned':''}" data-id="${e(badge.id)}" aria-label="${e(badge.name)}，${badge.earned?'已解锁':`${badge.current} / ${badge.target}`}"`)).join('')}</div></section>
      <section class="pp-panel">${heading('桌游展台',owner?action('选择主打桌游','edit-profile','class="hub-text-button" data-tab="general"'):'')}<div class="pp-game-showcase">${favorite?`<div class="pp-featured-game">${art(favorite.id)}<div><span class="pp-game-kicker">${details.favoriteGame?'我的主打':'常玩桌游'}</span><h3>${e(favorite.title)}</h3><div class="pp-featured-stats"><span><b>${favorite.played}</b> 场</span><span><b>${favorite.wins}</b> 胜</span>${favorite.bestScore!==null?`<span><b>${favorite.bestScore}</b> ${favorite.scoreDirection==='lower'?'最低罚分':'最高分'}</span>`:''}</div></div>${owner?action(icon('play')+'开一局','profile-play',`class="hub-secondary" data-game-id="${e(favorite.id)}"`):''}</div>`:`<div class="pp-compact-empty"><span>下一场，从你喜欢的桌游开始</span>${owner?action('选择桌游','edit-profile','class="hub-secondary" data-tab="general"'):''}</div>`}<div class="pp-game-library">${summary.perGame.filter(game=>game.id!==favorite?.id).map(game=>`<div class="pp-library-game">${art(game.id)}<div><b>${e(game.title)}</b><span>${game.played?`${game.played} 场 · ${game.wins} 胜`:'尚未对局'}</span></div></div>`).join('')}</div></div></section>
      <section class="pp-panel">${heading('藏品陈列',owner?action('布置展位','edit-profile','class="hub-text-button" data-tab="showcase"'):'')}<div class="pp-showcase">${showcase.length?showcase.map(item=>`<div class="pp-collectible" data-rarity="${item.rarity}">${itemArt(item,user.name)}<b>${e(item.name)}</b><span>${{avatar:'头像',banner:'背景',title:'称号'}[item.type]}</span></div>`).join(''):`<div class="pp-compact-empty"><span>展位暂未布置</span>${owner?action('选择藏品','edit-profile','class="hub-secondary" data-tab="showcase"'):''}</div>`}</div></section>
      <section class="pp-panel">${heading('最近对局',owner?action('全部战绩 '+icon('arrow'),'history','class="hub-text-button"'):'')}<div class="pp-recent">${data.recent.length?data.recent.map(match=>`<article class="pp-match"><div class="pp-match-art">${art(match.gameId)}</div><div class="pp-match-info"><h3>${e(match.gameTitle)}</h3><span>${date(match.endedAt)} · ${match.practice?'AI 练习':'真人对局'}</span></div><div class="pp-match-result ${match.won?'is-win':''}"><b>${match.left?'已离席':match.won?'胜利':'落败'}</b><span>#${match.rank} · ${match.score} ${match.scoreDirection==='lower'?'罚分':'分'}</span></div>${owner?action(icon('arrow'),'record',`class="hub-icon-button" data-id="${e(match.id)}" aria-label="查看 ${e(match.gameTitle)} 的战报"`):''}</article>`).join(''):`<div class="pp-compact-empty"><span>还没有对局记录</span>${owner?action('去开一局','practice','class="hub-secondary"'):''}</div>`}</div></section>
    </div><aside class="pp-sidebar">
      <section class="pp-side-panel"><div class="pp-side-status"><i class="${data.status==='offline'?'is-offline':''}"></i>${presence[data.status]??presence.online}</div><dl class="pp-side-counts"><div><dt>旅程徽章</dt><dd>${earned}</dd></div><div><dt>同桌好友</dt><dd>${data.friendCount}</dd></div><div><dt>游玩桌游</dt><dd>${summary.perGame.filter(game=>game.played).length}</dd></div></dl>${owner?`<div class="pp-side-links">${action(icon('bag')+'我的藏品','inventory')}${action(icon('chart')+'对局战绩','history')}${action(icon('room')+'我的房间','return-room')}</div>`:''}</section>
      ${owner?`<section class="pp-side-panel pp-friends">${heading('同桌好友',action(String(data.friendCount)+' '+icon('arrow'),'friends','class="hub-text-button"'))}<div class="pp-friend-grid">${data.friends.map(friend=>action(`${avatar(friend)}<span>${e(friend.name)}</span><i class="${friend.status==='offline'?'is-offline':''}"></i>`,'view-profile',`data-id="${e(friend.id)}" aria-label="查看 ${e(friend.name)} 的资料"`)).join('')||'<span class="pp-side-empty">还没有同桌好友</span>'}</div>${!data.friends.length?action('寻找好友','friends','class="hub-secondary"'):''}</section>
      <section class="pp-side-panel pp-wallet"><span>可用星辉</span><strong>✦ ${user.credits}</strong>${action('收支记录','wallet','class="hub-text-button"')}</section>
      <section class="pp-side-panel pp-account"><h2>账号</h2><span>${user.registered?e(user.handle):'游客身份'}</span>${user.registered?action('退出登录','logout-dialog','class="hub-text-button"'):action('绑定账号','auth','data-mode="register" class="hub-secondary"')}<span class="pp-privacy">${details.visibility==='private'?'资料仅自己可见':'资料对好友可见'}</span></section>`:''}
    </aside></div></div>`;
}

export function renderProfileEditor(user,items,games,tab='general'){
  const details=user.details??{},owned=items.filter(item=>user.inventory.includes(item.id));
  return `<div class="pp-editor"><header class="pp-editor-heading"><h2>编辑个人资料</h2></header><form novalidate data-hub-form="profile" data-revision="${user.revision}" data-showcase-order="${e(JSON.stringify(details.showcase??[]))}"><div class="pp-editor-tabs" role="group" aria-label="编辑资料分类">${[['general','基本资料'],['appearance','头像与背景'],['showcase','藏品陈列']].map(([id,label])=>action(label,'profile-tab',`data-tab="${id}" aria-pressed="${tab===id}"`)).join('')}</div><div class="pp-editor-layout"><div class="pp-editor-fields">
    <section data-profile-panel="general" ${tab==='general'?'':'hidden'}><label for="pp-edit-name">昵称</label><input id="pp-edit-name" name="name" value="${e(user.name)}" maxlength="24" required autocomplete="nickname"><label for="pp-edit-bio">个人简介 <span>160 字以内</span></label><textarea id="pp-edit-bio" name="bio" maxlength="160" rows="3" placeholder="说说你的牌桌故事">${e(details.bio??'')}</textarea><label for="pp-edit-game">主打桌游</label><select id="pp-edit-game" name="favoriteGame"><option value="">自动展示常玩桌游</option>${games.map(game=>`<option value="${e(game.id)}" ${details.favoriteGame===game.id?'selected':''}>${e(game.title)}</option>`).join('')}</select><label for="pp-edit-visibility">资料可见范围</label><select id="pp-edit-visibility" name="visibility"><option value="friends" ${details.visibility!=='private'?'selected':''}>好友可见</option><option value="private" ${details.visibility==='private'?'selected':''}>仅自己可见</option></select></section>
    <section data-profile-panel="appearance" ${tab==='appearance'?'':'hidden'}>${[['avatar','头像'],['banner','个人背景'],['title','称号']].map(([type,label])=>`<fieldset class="pp-choice-group"><legend>${label}</legend><div class="pp-appearance-grid pp-choices-${type}">${owned.filter(item=>item.type===type).map(item=>`<label class="pp-choice"><input type="radio" name="${type}" value="${item.id}" ${user.appearance[type]===item.id?'checked':''}><span class="pp-choice-art">${itemArt(item,user.name)}</span><span class="pp-choice-name">${e(item.name)}</span></label>`).join('')}</div></fieldset>`).join('')}<span class="pp-editor-hint">可在商城兑换更多外观</span></section>
    <section data-profile-panel="showcase" ${tab==='showcase'?'':'hidden'}><div class="pp-selection-heading"><h3>我的展位</h3><span id="pp-showcase-count">${details.showcase?.length??0} / 4</span></div><div id="pp-selected-slots" class="pp-selected-slots"></div><div class="pp-showcase-picker">${owned.map(item=>`<label class="pp-choice"><input type="checkbox" name="showcase" value="${item.id}" ${(details.showcase??[]).includes(item.id)?'checked':''}><span class="pp-choice-art">${itemArt(item,user.name)}</span><span class="pp-choice-name">${e(item.name)}</span></label>`).join('')}</div></section>
    </div><aside class="pp-editor-preview"><span>资料预览</span><div id="pp-live-preview" class="${bannerClass(user.appearance.banner)}">${profileIdentity(user,items)}</div><div id="pp-live-showcase"></div></aside></div><footer class="pp-editor-footer"><p class="hub-inline-error" role="alert"></p>${action('取消','close','class="hub-secondary"')}<button type="submit" class="hub-primary">保存更改</button></footer></form></div>`;
}

export function profileDraft(form){
  const values=Object.fromEntries(new FormData(form));
  const checked=new FormData(form).getAll('showcase'),order=JSON.parse(form.dataset.showcaseOrder??'[]');
  const showcase=[...order.filter(id=>checked.includes(id)),...checked.filter(id=>!order.includes(id))];
  return {name:values.name,bio:values.bio,favoriteGame:values.favoriteGame,visibility:values.visibility,showcase,appearance:{avatar:values.avatar,banner:values.banner,title:values.title},revision:Number(form.dataset.revision)};
}

export function updateProfilePreview(form,user,items){
  const draft=profileDraft(form),preview={...user,name:draft.name||'月下旅人',appearance:draft.appearance,details:draft};
  const box=form.querySelector('#pp-live-preview');box.className=bannerClass(draft.appearance.banner);box.innerHTML=profileIdentity(preview,items);
  form.dataset.showcaseOrder=JSON.stringify(draft.showcase);
  form.querySelector('#pp-selected-slots').innerHTML=draft.showcase.map((id,index)=>`<div><span>${index+1}</span><b>${e(items.find(item=>item.id===id)?.name??'')}</b><button type="button" data-action="hub:showcase-move" data-index="${index}" data-step="-1" ${index===0?'disabled':''} aria-label="前移藏品 ${e(items.find(item=>item.id===id)?.name??'')}">‹</button><button type="button" data-action="hub:showcase-move" data-index="${index}" data-step="1" ${index===draft.showcase.length-1?'disabled':''} aria-label="后移藏品 ${e(items.find(item=>item.id===id)?.name??'')}">›</button></div>`).join('');
  form.querySelector('#pp-showcase-count').textContent=`${draft.showcase.length} / 4`;
  form.querySelector('#pp-live-showcase').innerHTML=draft.showcase.map(id=>items.find(item=>item.id===id)).filter(Boolean).map(item=>`<div>${itemArt(item,preview.name)}<span>${e(item.name)}</span></div>`).join('');
  form.querySelectorAll('[name="showcase"]:not(:checked)').forEach(input=>{input.disabled=draft.showcase.length>=4;});
}
