import { lobbyHeader } from './lobby.js';
import {avatar} from './hub/cosmetics.js';

/** The navigation stays mounted while only the page below it changes. */
export function createShell(root) {
  const template = document.createElement('template');
  template.innerHTML = lobbyHeader();
  const header = template.content.firstElementChild;
  const announcement=document.createElement('aside');announcement.className='system-announcement';announcement.hidden=true;announcement.setAttribute('aria-label','系统公告');
  let system={siteName:'Moon Table',announcement:''};
  header.insertAdjacentHTML('beforeend', `<dialog class="platform-dialog shell-menu" aria-label="更多导航"><button class="dialog-close" data-action="close-shell-menu" aria-label="关闭导航">×</button><h2>更多</h2><div class="shell-menu-links"><button data-action="forum">玩家论坛</button><button data-action="friends">好友</button><button data-action="history">战绩</button><button data-action="shop">商城</button><button data-action="notifications">通知</button></div></dialog>`);
  header.insertAdjacentHTML('beforeend','<button type="button" data-action="admin" class="shell-admin-entry" hidden>♛ 管理</button>');
  header.querySelector('.shell-menu-links').insertAdjacentHTML('beforeend','<button type="button" data-action="admin" hidden>管理中心</button>');
  root.prepend(header,announcement);

  function update(user, active) {
    header.querySelectorAll('[data-action="admin"]').forEach(button=>{button.hidden=!user?.admin;});
    if(active)for (const button of header.querySelectorAll('nav [data-action]')) {
      if (button.dataset.action === active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    header.querySelector('.profile-avatar').innerHTML = avatar(user);
    header.querySelector('.lobby-profile b').textContent = user?.name ?? '月下旅人';
    const status = header.querySelector('.lobby-profile small');
    status.lastChild.textContent = user ? '在线' : '未入座';
  }

  return {
    update,
    updateSettings(value){system=value;header.querySelector('.lobby-brand b').textContent=system.siteName;announcement.textContent=system.announcement;announcement.hidden=!system.announcement;document.title=system.siteName;},
    openMenu: () => header.querySelector('.shell-menu').showModal(),
    closeMenu: () => header.querySelector('.shell-menu').close(),
    show(html, user, active = 'lobby-home') {
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
      root.append(template.content);
    },
  };
}
