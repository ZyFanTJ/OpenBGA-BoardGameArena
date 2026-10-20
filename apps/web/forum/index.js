import {api} from '../api.js';
import {escapeHtml as e} from '../ui.js';
import {forumPage, topicList, topicDetail, topicComposer, supportComposer} from './views.js';

export function createForum({root, shell, getUser, identify, notify}) {
  let active = false, generation = 0, topic = null, working = false, returnFocus;
  const filters = {category: 'all', status: 'all', sort: 'activity', q: '', page: 1};
  function dispose() { active = false; topic = null; generation++; }
  function modal(html) {
    const dialog = root.querySelector('#forum-dialog');
    returnFocus = document.activeElement;
    dialog.innerHTML = html; dialog.setAttribute('aria-labelledby', 'forum-dialog-title'); dialog.showModal();
    dialog.querySelector('input:not([type=radio])')?.focus();
  }
  function close() { root.querySelector('#forum-dialog')?.close(); returnFocus?.focus(); }
  async function loadList() {
    const token = ++generation;
    const results = root.querySelector('#forum-results');
    results?.setAttribute('aria-busy', 'true');
    try {
      const data = await api('/forum?' + new URLSearchParams(filters));
      if (!active || topic || token !== generation) return;
      results.innerHTML = topicList(data, filters.category !== 'all' || filters.status !== 'all' || !!filters.q);
      root.querySelectorAll('[data-forum-count]').forEach(el => { el.textContent = data.counts[el.dataset.forumCount]; });
      root.querySelectorAll('[data-action="forum:category"]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.category === filters.category)));
      root.querySelectorAll('[data-action="forum:filter"]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.status === filters.status)));
    } catch (error) {
      if (active && token === generation) results.innerHTML = `<div class="forum-empty"><h2>暂时没能搬来话题</h2><p>${e(error.message)}</p><button class="forum-secondary" data-action="forum:refresh">重试</button></div>`;
    } finally { if (token === generation) results?.setAttribute('aria-busy', 'false'); }
  }
  async function open(id, {replace = false} = {}) {
    active = true; topic = null;
    const token = ++generation, hash = '#forum' + (id ? '/' + encodeURIComponent(id) : '');
    shell.closeMenu();
    if (location.hash !== hash) history[replace ? 'replaceState' : 'pushState'](null, '', hash);
    if (!id) {
      shell.show(forumPage(), getUser(), 'forum');
      root.querySelector('#forum-query').value = filters.q;
      root.querySelector('#forum-sort').value = filters.sort;
      await loadList(); scrollTo(0, 0); return;
    }
    shell.show('<main class="forum-page"><div class="forum-empty">正在打开话题…</div></main>', getUser(), 'forum');
    try {
      const data = await api('/forum/' + encodeURIComponent(id));
      if (!active || token !== generation) return;
      topic = data; shell.show(topicDetail(topic, getUser()), getUser(), 'forum'); scrollTo(0, 0);
    } catch (error) {
      if (!active || token !== generation) return;
      shell.show(`<main class="forum-page"><div class="forum-empty"><h1>${error.status === 404 ? '话题不存在' : '暂时无法打开话题'}</h1><p>${e(error.message)}</p><button class="forum-secondary" data-action="forum:list">返回话题广场</button></div></main>`, getUser(), 'forum');
    }
  }
  function renderTopic(data, {preserveDraft = true} = {}) {
    const replyForm = root.querySelector('[data-forum-form="reply"]');
    const draft = preserveDraft && replyForm ? Object.fromEntries(new FormData(replyForm)) : null;
    const focusId = document.activeElement?.id;
    const focusAction = document.activeElement?.dataset.action;
    const y = scrollY; topic = data;
    shell.show(topicDetail(topic, getUser()), getUser(), 'forum'); scrollTo(0, y);
    if (draft) {
      const form = root.querySelector('[data-forum-form="reply"]');
      if (form) for (const [key, value] of Object.entries(draft)) if (form.elements[key]) form.elements[key].value = value;
      if (focusId) document.getElementById(focusId)?.focus({preventScroll: true});
    }
    if (focusAction) root.querySelector(`[data-action="${focusAction}"]`)?.focus({preventScroll: true});
  }
  async function handle(action, target) {
    if (!active) return;
    if (working && ['support', 'status', 'new'].includes(action)) return;
    if (action === 'close') return close();
    if (action === 'list') return open();
    if (action === 'topic') return open(target.dataset.id);
    if (action === 'new') { modal(topicComposer(getUser(), target?.dataset.category)); return; }
    if (action === 'refresh') return loadList();
    if (action === 'category' || action === 'filter' || action === 'page' || action === 'reset') {
      if (action === 'category') filters.category = target.dataset.category;
      if (action === 'filter') filters.status = target.dataset.status;
      filters.page = action === 'page' ? Number(target.dataset.page) : 1;
      if (action === 'reset') { Object.assign(filters, {category: 'all', status: 'all', q: ''}); root.querySelector('#forum-query').value = ''; }
      return loadList();
    }
    if (action === 'support') {
      if (!getUser()) { modal(supportComposer()); return; }
      renderTopic(await api(`/forum/${topic.id}/support`, {supported: !topic.supported}));
    }
    if (action === 'status') {
      try { renderTopic(await api(`/forum/${topic.id}/status`, {status: topic.status === 'open' ? 'closed' : 'open', revision: topic.revision})); }
      catch (error) { if (error.status === 409) renderTopic(await api(`/forum/${topic.id}`)); throw error; }
    }
  }
  async function submit(form) {
    if (!active || working) return;
    const data = Object.fromEntries(new FormData(form)), kind = form.dataset.forumForm;
    if (kind === 'search') { filters.q = data.q.trim(); filters.page = 1; return loadList(); }
    working = true;
    const token = generation, id = topic?.id;
    const buttons = [...form.querySelectorAll('button')]; buttons.forEach(b => { b.disabled = true; });
    try {
      await identify(data.name);
      if (!active || token !== generation) return;
      const result = await api(kind === 'create' ? '/forum' : `/forum/${id}/${kind === 'reply' ? 'replies' : 'support'}`, kind === 'support' ? {supported: true} : data);
      if (!active || token !== generation) return;
      if (kind === 'create') { close(); await open(result.id); notify('话题已发布'); }
      else { renderTopic(result, {preserveDraft: kind !== 'reply'}); if (kind === 'reply') { root.querySelector('.forum-replies article:last-child')?.scrollIntoView({behavior: 'smooth', block: 'center'}); notify('回复已发表'); } }
    } catch (error) { notify(error.message); }
    finally { working = false; buttons.forEach(b => { b.disabled = false; }); }
  }
  function change(target) { if (active && target.id === 'forum-sort') { filters.sort = target.value; filters.page = 1; loadList(); } }
  return {open, dispose, handle, submit, change, get active() { return active; }};
}
