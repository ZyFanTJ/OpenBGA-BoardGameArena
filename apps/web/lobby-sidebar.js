import {escapeHtml as e} from './ui.js';
import {icon} from './icons.js';
import {avatar} from './hub/cosmetics.js';
import {loadStyles} from './styles-loader.js';

// Dated product releases, shared by the lobby sidebar and full update log.
export const lobbyUpdates = [
  {date:'2026-10-31',category:'新游戏',icon:'dice',title:'开溜！与 DNUP 上线',detail:'新增组队营地卡牌游戏开溜！和双向翻转卡牌 DNUP，支持 AI 对手、玩法手卡和独立游戏美术。'},
  {date:'2026-10-31',category:'体验优化',icon:'spark',title:'CABO 音效与牌桌体验更新',detail:'新增 CABO 音效设置，调整玩法手卡和游戏交互。'},
  {date:'2026-10-28',category:'新游戏',icon:'dice',title:'潮汐守望上线',detail:'新增潮汐守望、实时战场与 AI 对手，支持开局构筑和独立玩法手卡。'},
  {date:'2026-10-28',category:'社交与体验',icon:'people',title:'好友私聊、约局与外观更新',detail:'新增好友私聊与约局，扩充商城外观，并优化实时同步、CABO 动画和玩家身份展示。'},
  {date:'2026-10-24',category:'体验优化',icon:'spark',title:'大厅更新与 CABO 操作优化',detail:'调整游戏搜索、分类与房间列表，新增游戏 Hot 标记，优化 CABO 操作倒计时、动画恢复和行动呼吸光。'},
  {date:'2026-10-24',category:'社区动态',icon:'people',title:'好友在线时间与论坛玩家外观',detail:'好友显示状态与上次在线时间，论坛话题、主帖及回复展示当前头像、头像框和称号徽章。'},
  {date:'2026-10-24',category:'新游戏',icon:'dice',title:'德州扑克上线，邀好友同桌竞技',detail:'支持 2–8 人无上限桌内筹码赛、AI 陪练、全押与边池结算。筹码仅用于本场对局。'},
  {date:'2026-10-24',category:'游戏体验',icon:'people',title:'公开观战与图解玩法手卡',detail:'公开牌桌可进入观战，房主可控制观战开关；各款游戏新增图解速查，开局前即可了解玩法。'},
  {date:'2026-10-24',category:'体验优化',icon:'spark',title:'大厅焕新，页面加载更轻快',detail:'大厅整合可加入牌桌、最近游玩与 AI 陪练入口，页面和规则按需加载，优化展示图片、历史查询与论坛存储。'},
  {date:'2026-10-24',category:'账号功能',icon:'people',title:'账号密码与游戏开放管理',detail:'优化游客绑定账号，管理中心新增注册账号密码重置和各游戏上线开关。'},
  {date:'2026-10-23',category:'新游戏',icon:'dice',title:'卡坦岛上线，开拓你的岛屿',detail:'支持 3–4 人基础玩法、AI 陪练，以及资源交易、道路与城镇建设。'},
  {date:'2026-10-22',category:'新游戏',icon:'dice',title:'UNO 上线，经典四色卡牌开桌',detail:'新增 UNO 游戏与对应牌桌界面。'},
  {date:'2026-10-22',category:'体验优化',icon:'people',title:'好友邀请与实时同步优化',detail:'修复邀请问题，优化系统传输与性能。'},
  {date:'2026-10-20',category:'社区动态',icon:'chat',title:'玩家论坛更新',detail:'在论坛交流玩法、提出建议、寻找同桌。'},
  {date:'2026-10-19',category:'游戏更新',icon:'dice',title:'七大奇迹更新',detail:'更新七大奇迹玩法与游戏体验。'},
  {date:'2026-10-04',category:'里程碑',icon:'spark',title:'Moon Table 初次启程',detail:'项目建立，开始打造月下的在线桌游空间。'},
];

/** The full log and the sidebar use the same dated product history. */
export async function openUpdateLog(root,selectedIndex){
 await loadStyles(['/update-log.css']);
 root.querySelector('#update-log-dialog')?.remove();
 const opener=document.activeElement,dialog=document.createElement('dialog'),groups=new Map();
 lobbyUpdates.forEach((update,index)=>{
  if(!groups.has(update.date))groups.set(update.date,[]);
  groups.get(update.date).push({...update,index});
 });
 dialog.id='update-log-dialog';dialog.setAttribute('aria-labelledby','update-log-title');
 dialog.innerHTML=`<header class="update-log-heading"><div class="update-log-emblem" aria-hidden="true">${icon('megaphone')}</div><div><span>MOON TABLE · WHAT’S NEW</span><h2 id="update-log-title">更新日志</h2><p>新游戏、功能改进与社区动态。</p></div><button type="button" class="update-log-close" aria-label="关闭更新日志" autofocus>×</button></header><div class="update-log-body" tabindex="0" aria-label="按日期排列的更新记录">${[...groups].map(([date,updates],i)=>`<section class="update-log-group${i===0?' is-latest':''}" aria-label="${e(date)} 更新"><div class="update-log-date"><time datetime="${e(date)}"><span>${date.slice(5).replace('-',' / ')}</span><small>${date.slice(0,4)}</small></time>${i===0?'<b>最新</b>':''}</div><div class="update-log-entries">${updates.map(update=>`<article class="update-log-entry${update.index===selectedIndex?' is-selected':''}" data-update-entry="${update.index}"><div class="update-log-category">${icon(update.icon)}<span>${e(update.category)}</span></div><h3>${e(update.title)}</h3><p>${e(update.detail)}</p></article>`).join('')}</div></section>`).join('')}</div><footer class="update-log-footer"><span>${icon('clock')}共 ${lobbyUpdates.length} 条更新</span><button type="button" class="update-log-dismiss">知道了</button></footer>`;
 root.append(dialog);
 dialog.querySelectorAll('.update-log-close,.update-log-dismiss').forEach(button=>button.addEventListener('click',()=>dialog.close()));
 dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});},{once:true});
 dialog.showModal();
 if(Number.isInteger(selectedIndex))dialog.querySelector(`[data-update-entry="${selectedIndex}"]`)?.scrollIntoView({block:'nearest'});
}

export function lastOnline(seen,now=Date.now()){
  if(!Number.isFinite(seen)||seen<0)return '';
  const seconds=Math.max(0,(now-seen)/1000);
  for(const [unit,size] of [['年',31536000],['个月',2592000],['天',86400],['小时',3600],['分钟',60]])if(seconds>=size)return `${Math.floor(seconds/size)} ${unit}前在线`;
  return '刚刚在线';
}

export function lobbyFriends(friends = [], now = Date.now()) {
  const people = [...friends].sort((a,b) => Number(a.status==='offline')-Number(b.status==='offline')).slice(0,3);
  if (!people.length) return `<div class="lobby-friends-empty"><span class="friend-orbits">${icon('people')}</span><p>找几位好友，一起入座</p><button class="outline-button" data-action="friends">寻找同桌好友</button></div>`;
  return people.map(person => {
    const offline = person.status === 'offline';
    const detail = offline ? lastOnline(person.lastSeenAt,now) : person.status === 'playing' ? (person.gameTitle ? `正在玩 ${person.gameTitle}` : '对局中') : person.status === 'lobby' ? '等待中' : '可以一起玩';
    const tooltip=offline&&detail?`上次在线：${new Date(person.lastSeenAt).toLocaleString('zh-CN')}`:detail;
    return `<div class="lobby-friend-row">${avatar(person)}<div class="lobby-friend-info"><b>${e(person.name)}</b><small class="${offline?'is-offline':''}" title="${e(tooltip)}"><i></i><span>${offline?'离线':'在线'}</span>${detail?`<span class="lobby-friend-detail">· ${e(detail)}</span>`:''}</small></div><button class="outline-button" data-action="hub:view-profile" data-id="${e(person.id)}" aria-label="查看 ${e(person.name)} 的资料">资料</button></div>`;
  }).join('');
}

export function lobbySidebar() {
  return `<section class="friends-panel lobby-friends-card"><div class="section-heading"><h2>${icon('people')}同桌好友</h2><button class="text-button" data-action="friends" aria-label="查看全部好友">查看全部 ${icon('chevron')}</button></div><div class="lobby-friend-list">${lobbyFriends()}</div></section>
  <div class="lobby-ai-frame"><button class="lobby-sidebar-ai" data-action="open-practice"><span class="lobby-robot">${icon('robot')}</span><span class="lobby-sidebar-ai-copy"><b>和 AI 玩</b><small>随时开局，练习或放松</small></span>${icon('chevron')}</button></div>
  <section class="lobby-updates"><div class="section-heading"><h2>${icon('megaphone')}最近更新</h2><button class="text-button" data-action="lobby-updates" aria-label="查看全部更新">查看全部 ${icon('chevron')}</button></div><ul>${lobbyUpdates.slice(0,4).map((update,index)=>`<li><span class="update-dot" aria-hidden="true"></span><button data-action="lobby-updates" data-update-index="${index}" title="${e(update.title)}">${e(update.title)}</button><time datetime="${update.date}">${update.date.slice(5)}</time></li>`).join('')}</ul></section>`;
}
