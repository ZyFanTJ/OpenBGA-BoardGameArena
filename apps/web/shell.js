import { lobbyHeader } from './lobby.js';

/** The navigation stays mounted while only the page below it changes. */
export function createShell(root) {
  const template = document.createElement('template');
  template.innerHTML = lobbyHeader();
  const header = template.content.firstElementChild;
  header.insertAdjacentHTML('beforeend', `<dialog class="platform-dialog shell-menu" aria-label="更多导航"><button class="dialog-close" data-action="close-shell-menu" aria-label="关闭导航">×</button><h2>更多</h2><div class="shell-menu-links"><button data-action="soon-friends">好友</button><button data-action="soon-history">战绩</button><button data-action="soon-shop">商城</button><button data-action="notifications">通知</button></div></dialog>`);
  root.prepend(header);

  function update(user, active = 'lobby-home') {
    for (const button of header.querySelectorAll('nav [data-action]')) {
      if (button.dataset.action === active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    header.querySelector('.profile-avatar').textContent = user?.name?.[0] ?? '◐';
    header.querySelector('.lobby-profile b').textContent = user?.name ?? '月下旅人';
    const status = header.querySelector('.lobby-profile small');
    status.lastChild.textContent = user ? '在线' : '未入座';
  }

  return {
    update,
    openMenu: () => header.querySelector('.shell-menu').showModal(),
    closeMenu: () => header.querySelector('.shell-menu').close(),
    show(html, user, active = 'lobby-home') {
      update(user, active);
      template.innerHTML = html;
      for (const child of [...root.childNodes]) if (child !== header) child.remove();
      root.append(template.content);
    },
  };
}
