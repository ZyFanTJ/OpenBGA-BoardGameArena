import {siteFooter} from './site-footer.js';
import { lobbyHeader } from './lobby.js';
import {avatar, titleBadge} from './hub/cosmetics.js';
import {icon} from './icons.js';

/** The navigation stays mounted while only the page below it changes. */
export function createShell(root) {
  const template = document.createElement('template');
  template.innerHTML = lobbyHeader();
  const header = template.content.firstElementChild;
  const announcement=document.createElement('aside');announcement.className='system-announcement';announcement.hidden=true;announcement.setAttribute('aria-label','系统公告');
  let system={siteName:'Moon Table',announcement:''};
  header.insertAdjacentHTML('beforeend', `<dialog id="shell-menu" class="shell-menu" aria-label="导航菜单"><div class="shell-menu-heading"><b class="shell-menu-brand">Moon Table</b><button type="button" data-action="close-shell-menu" aria-label="关闭导航" autofocus>×</button></div><div class="shell-menu-links" role="navigation" aria-label="全部导航">${[['home','游戏大厅','lobby-home'],['room','我的房间','my-room'],['chat','玩家论坛','forum'],['people','好友','friends'],['chart','战绩','history'],['bag','商城','shop'],['bell','通知','notifications']].map(([i,label,action])=>`<button type="button" data-action="${action}">${icon(i)}<span>${label}</span></button>`).join('')}</div><button type="button" class="shell-menu-profile" data-action="profile"><span class="shell-menu-avatar"></span><span class="shell-menu-identity"><b></b><span class="shell-menu-title"></span><small></small></span>${icon('arrow')}</button></dialog>`);
  header.insertAdjacentHTML('beforeend','<button type="button" data-action="admin" class="shell-admin-entry" hidden>♛ 管理</button>');
  header.querySelector('.shell-menu-links').insertAdjacentHTML('beforeend',`<button type="button" data-action="admin" hidden>${icon('crown')}<span>管理中心</span></button>`);
  root.prepend(header,announcement);
  const menu = header.querySelector('.shell-menu');
  const toggle = header.querySelector('.shell-menu-toggle');
  const navigation=header.querySelector('nav');
  function syncNavIndicator(){
    const selected=navigation.querySelector('button[aria-current=page]');
    const visible=selected&&selected.getClientRects().length>0;
    navigation.dataset.hasSelection=String(!!visible);
    if(!visible)return;
    navigation.style.setProperty('--nav-active-x',`${selected.offsetLeft}px`);
    navigation.style.setProperty('--nav-active-y',`${selected.offsetTop}px`);
    navigation.style.setProperty('--nav-active-width',`${selected.offsetWidth}px`);
    navigation.style.setProperty('--nav-active-height',`${selected.offsetHeight}px`);
    if(!navigation.dataset.indicatorReady)requestAnimationFrame(()=>{navigation.dataset.indicatorReady='true';});
  }
  new ResizeObserver(syncNavIndicator).observe(navigation);
  const closeMenu = () => {
    menu.close();
    toggle.setAttribute('aria-expanded', 'false');
  };
  menu.addEventListener('close', () => toggle.setAttribute('aria-expanded', String(menu.open)));
  menu.addEventListener('click', event => {
    const bounds = menu.getBoundingClientRect();
    if (event.target === menu && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeMenu();
    if (event.target.closest('[data-action]')) closeMenu();
  });
  const mobile = matchMedia('(max-width:760px), (max-height:500px) and (max-width:1000px)');
  mobile.addEventListener('change', () => { if (!mobile.matches) closeMenu(); });

  function update(user, active) {
    header.querySelectorAll('[data-action="admin"]').forEach(button=>{button.hidden=!user?.admin;});
    if(active)for (const button of header.querySelectorAll('nav [data-action], .shell-menu-links [data-action], .shell-menu-profile')) {
      if (button.dataset.action === active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    syncNavIndicator();
    header.querySelector('.profile-avatar').innerHTML = avatar(user);
    header.querySelector('.lobby-profile b').textContent = user?.name ?? '月下旅人';
    const status = header.querySelector('.lobby-profile small');
    status.lastChild.textContent = user ? '在线' : '未入座';
    menu.querySelector('.shell-menu-avatar').innerHTML = avatar(user);
    menu.querySelector('.shell-menu-identity b').textContent = user?.name ?? '月下旅人';
    menu.querySelector('.shell-menu-title').innerHTML = user ? titleBadge(user) : '';
    menu.querySelector('.shell-menu-identity small').textContent = user ? '在线 · 查看个人主页' : '未入座 · 点击设置个人信息';
  }

  return {
    update,
    updateSettings(value){system=value;header.querySelector('.lobby-brand b').textContent=system.siteName;header.querySelector('.shell-menu-brand').textContent=system.siteName;announcement.textContent=system.announcement;announcement.hidden=!system.announcement;document.title=system.siteName;const footer=root.querySelector('.site-footer');if(footer)footer.outerHTML=siteFooter(system);},
    openMenu: () => { menu.showModal(); toggle.setAttribute('aria-expanded', 'true'); },
    closeMenu,
    show(html, user, active = 'lobby-home') {
      closeMenu();
      update(user, active);
      const search = header.querySelector('#lobby-search');
      const searchInactive = !['lobby-home','my-room'].includes(active);
      search.closest('label').classList.toggle('is-inactive', searchInactive);
      search.closest('label').setAttribute('aria-hidden', String(searchInactive));
      search.disabled = searchInactive;
      search.value = '';
      search.placeholder = active === 'my-room' ? '搜索房间…' : '搜索游戏…';
      search.setAttribute('aria-label', active === 'my-room' ? '搜索房间' : '搜索游戏');
      template.innerHTML = html;
      for (const child of [...root.childNodes]) if (child !== header&&child!==announcement) child.remove();
      template.content.querySelectorAll('.moon-footer,.hub-footer-mark').forEach(el=>el.remove());
      root.append(template.content);
      const page=root.querySelector(':scope>main');
      if(page&&!page.classList.contains('room-layout'))page.classList.add('shell-page-enter');
      root.insertAdjacentHTML('beforeend',siteFooter(system));
    },
  };
}
