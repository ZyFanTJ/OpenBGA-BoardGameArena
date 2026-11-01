import {lobbySidebar} from './lobby-sidebar.js';
import { escapeHtml as e, button as plainButton } from './ui.js';
import { icon } from './icons.js';
import {createSetup,setupIcon} from './room-setup.js';
// Labels here are trusted icon markup; all dynamic fields are escaped at insertion.
const b = (html, ...args) => plainButton('', ...args).replace('</button>', html + '</button>');

export function lobbyTables(rooms, games, metadata) {
  games=games.filter(g=>g.enabled!==false);
  const available = [...new Map(rooms.map(room=>[room.id,room])).values()].filter(room => room.status === 'lobby' && room.count < room.maxPlayers && games.some(game => game.id === room.gameId));
  const heading = `<div class="section-heading"><h2>${icon(available.length ? 'people' : 'dice')}${available.length ? '正在等人的牌桌' : '和 AI 玩一局'}</h2>${b(`查看全部房间 ${icon('arrow')}`,'browse-rooms',false,'class="text-button"')}</div>`;
  if (!available.length) return heading + `<div class="lobby-ai-invitation"><div class="lobby-ai-art" aria-hidden="true"><span>☾</span><span>✦</span><span>♧</span></div><div class="lobby-ai-copy"><h3>暂时没有空位，先和 AI 热热身。</h3></div>${b(`和 AI 玩一局 ${icon('arrow')}`,'open-practice',!games.length,'class="gold-button"')}</div>`;
  return heading + `<div class="lobby-table-grid">${available.slice(0,3).map(room => {
    const game = games.find(game => game.id === room.gameId), meta = metadata[room.gameId] ?? {};
    return `<article class="lobby-table-card"><div class="game-cover ${e(meta.coverClass ?? '')}" aria-hidden="true">${meta.artHtml ?? ''}</div><div class="lobby-table-copy"><div class="lobby-table-label"><strong>${e(game.title)}</strong><span>等待中</span></div><h3 title="${e(room.title)}">${e(room.title)}</h3><p>${icon('people')}${room.count} / ${room.maxPlayers} 人 · 房主 ${e(room.host)}</p>${b('加入牌桌 →','join-public',false,`class="gold-button" data-room-id="${e(room.id)}" aria-label="加入 ${e(room.title)}"`)}</div></article>`;
  }).join('')}</div>`;
}

export function lobbyRecent(records, games) {
  games=games.filter(g=>g.enabled!==false);
  const recent = [...new Set(records.map(record => record.gameId))].map(id => games.find(game => game.id === id)).filter(Boolean).slice(0,2);
  return recent.length ? `<span>最近玩过</span><div>${recent.map(game => b(`${icon('dice')}<span>${e(game.title)}</span>${icon('arrow')}`,'open-create',false,`class="lobby-recent-game" data-game-id="${e(game.id)}"`)).join('')}</div>` : `${b(`${setupIcon('book-open')}<span>看看玩法，轻松入座</span>${icon('arrow')}`,'help',false,'class="lobby-rules-entry"')}`;
}

const upcoming = [
  ['werewolf', '狼人杀', '6–18', '15–30', '聚会推理', '推理 · 社交 · 经典', 0],
  ['avalon', '阿瓦隆', '5–10', '30–60', '策略对战', '身份 · 策略 · 阵营', 1],
  ['undercover', '谁是卧底', '4–12', '15–30', '聚会推理', '推理 · 聚会 · 轻松', 2],
  ['ludo', '飞行棋', '2–4', '15–30', '家庭休闲', '休闲 · 亲子 · 经典', 4],
];
export function lobbyHeader(user, active = 'lobby-home') {
  return `<header class="lobby-nav"><a href="/" class="lobby-brand" data-action="lobby-home"><span class="moon-mark"></span><span><b>MOON TABLE</b></span></a>
    <nav aria-label="主导航">${[['home','游戏大厅','lobby-home'],['room','我的房间','my-room'],['chat','玩家论坛','forum'],['people','好友','friends'],['chart','战绩','history'],['bag','商城','shop']].map(([i,label,action],n)=>b(`${icon(i)}<span>${label}</span>`,action,false,`${action===active?'aria-current="page"':''}`)).join('')}</nav>
    <label class="lobby-search">${icon('search')}<input id="lobby-search" type="search" placeholder="搜索游戏、房间…" aria-label="搜索游戏或房间"></label>
    ${b(icon('search'),'mobile-search',false,'class="mobile-header-search" aria-label="搜索游戏"')}
    ${b(icon('bell'),'notifications',false,'class="notification-button" aria-label="通知"')}
    <button class="lobby-profile" data-action="profile"><span class="profile-avatar">${e(user?.name?.[0] ?? '◐')}</span><span><b>${e(user?.name ?? '月下旅人')}</b><small><i></i>${user ? '在线' : '未入座'}</small></span><span>⌄</span></button><button class="shell-menu-toggle" data-action="shell-menu" aria-label="打开导航菜单" aria-controls="shell-menu" aria-expanded="false"><span aria-hidden="true">☰</span><span>菜单</span></button></header>`;
}
/** Only registry games can be created; future covers are explicitly marked as previews. */
export function lobbyHtml(user, games, metadata, rooms = []) {
  games=games.filter(g=>g.enabled!==false);
  const featured = games[0];
  const catalog = [...games.map(g=>({id:g.id,title:g.title,players:`${g.minPlayers}–${g.maxPlayers}`,time:metadata[g.id]?.duration??'',category:metadata[g.id]?.catalogCategory??metadata[g.id]?.category??'策略对战',tags:metadata[g.id]?.tags??'',available:true})),...upcoming.map(([id,title,players,time,category,tags,tile])=>({id,title,players,time,category,tags,tile}))];
  return `<main class="moon-lobby"><div class="lobby-main">
    <div class="lobby-feature-row"><section class="moon-hero" aria-label="推荐桌游"><div class="moon-hero-copy"><h1>好朋友就该在一起玩游戏！</h1><div class="hero-buttons">${b(`${icon('plus')}创建房间${icon('arrow')}`,'open-create',!featured,'class="gold-button"')}${b(`${icon('people')}加入房间${icon('arrow')}`,'focus-join',false,'class="outline-button"')}</div><div class="lobby-recent" id="lobby-recent">${lobbyRecent([],games)}</div></div></section>
    ${joinPanel(user)}</div>
    <section class="lobby-tables" id="lobby-tables" aria-label="推荐牌桌">${lobbyTables(rooms,games,metadata)}</section>
    <section class="moon-catalog" id="games"><div class="section-heading"><h2>${icon('dice')}今天玩什么</h2><div class="catalog-toolbar"><div class="catalog-filters" role="group" aria-label="游戏分类">${['全部','聚会推理','卡牌游戏','策略对战','家庭休闲'].map((label,i)=>b(label,'filter-games',false,`data-filter="${label}" aria-pressed="${i===0}"`)).join('')}</div><nav class="catalog-pagination" aria-label="桌游翻页"><button data-action="catalog-page" data-step="-1" aria-label="上一页桌游">‹</button><output aria-live="polite"></output><button data-action="catalog-page" data-step="1" aria-label="下一页桌游">›</button></nav></div></div><div class="moon-game-grid">${catalog.map(g=>`<article class="moon-game" hidden data-category="${g.category}" data-game-search="${e(g.title.toLowerCase())}"><div class="game-cover ${g.available?metadata[g.id]?.coverClass??'':`cover-tile cover-${g.tile}`}" role="img" aria-label="${e(g.title)} 封面">${g.available?metadata[g.id]?.artHtml??'':''}<span class="game-availability">${g.available?'现已上线':'即将上线'}</span></div><div class="game-card-copy"><h3>${e(g.title)}</h3><p>${icon('people')}${g.players}人 <span>${icon('clock')}${g.time}分钟</span></p><div class="small-tags">${g.tags.split(' · ').map(t=>`<span>${t}</span>`).join('')}</div>${g.available?b('创建房间','open-create',false,`class="gold-button" data-game-id="${e(g.id)}" aria-label="创建 ${e(g.title)} 房间"`):'<button class="coming-button" disabled>敬请期待</button>'}</div></article>`).join('')}</div><p class="catalog-no-results" hidden>没有找到相关游戏</p></section>

    </div><aside class="lobby-sidebar"><section class="moon-friend-banner" role="img" aria-label="月夜窗边的猫"></section>${lobbySidebar()}</aside>
    </main>${lobbyFooter()}${lobbyDialogs(user,games,metadata)}`;
}

export function joinPanel(user) { return `<section class="moon-join" id="join-panel"><h2>${icon('compass')}加入房间</h2><form id="join"><label for="join-name">你的昵称</label><input id="join-name" name="name" maxlength="24" placeholder="月下旅人" value="${e(user?.name ?? '')}" ${user?'readonly':''} required autocomplete="nickname"><label for="code">房间码</label><input id="code" name="code" maxlength="8" minlength="8" placeholder="输入 8 位房间码" required autocomplete="off" spellcheck="false"><button class="gold-button">加入房间 ${icon('arrow')}</button></form>${b('和 AI 玩 →','open-practice',false,'class="practice-link"')}</section>`; }
export function lobbyFooter() { return `<footer class="moon-footer"><span><span class="moon-mark"></span><b>MOON TABLE</b></span><div>${b('关于我们','about',false,'class="text-button"')}${b('玩法帮助','help',false,'class="text-button"')}</div></footer>`; }
export function lobbyDialogs(user,games,metadata,{joinInDialog=false}={}) {
  games=games.filter(g=>g.enabled!==false);
  const meta=metadata[games[0]?.id]??{};
  return `${createSetup(user,games,metadata)}
    <dialog id="lobby-join-dialog" class="platform-dialog" aria-label="加入房间"><button class="dialog-close" data-action="close-join" aria-label="关闭加入房间">×</button>${joinInDialog?joinPanel(user):''}</dialog>${infoDialog()}`;
}

export function infoDialog() { return '<dialog id="lobby-info-dialog" class="platform-dialog"><button class="dialog-close" data-action="close-info" aria-label="关闭说明">×</button><h2 id="lobby-info-title"></h2><p id="lobby-info-text"></p></dialog>'; }
