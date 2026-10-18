/** A single shelf of games, filtered and paged at the current card width. */
export function createCatalog(root) {
  const grid = root.querySelector('.moon-game-grid');
  const cards = [...grid.querySelectorAll('[data-game-search]')];
  const pager = root.querySelector('.catalog-pagination');
  let page = 0, roomPage = 0, pageSize = 1;
  function render(reset = false) {
    if (reset) { page = 0; roomPage = 0; }
    const query = root.querySelector('#lobby-search')?.value.trim().toLowerCase() ?? '';
    const category = root.querySelector('[data-filter][aria-pressed=true]')?.dataset.filter ?? '全部';
    pageSize = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    const matches = cards.filter(card => card.dataset.gameSearch.includes(query) && (category === '全部' || card.dataset.category === category));
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    page = Math.min(page, pages - 1);
    const visible = new Set(matches.slice(page * pageSize, (page + 1) * pageSize));
    cards.forEach(card => { card.hidden = !visible.has(card); });
    const roomGrid = root.querySelector('.public-rooms');
    const roomCards = [...roomGrid.querySelectorAll('[data-room-search]')];
    const roomMatches = roomCards.filter(card => card.dataset.roomSearch.includes(query));
    const roomSize = Math.max(1, getComputedStyle(roomGrid).gridTemplateColumns.split(' ').length);
    const roomPages = Math.max(1, Math.ceil(roomMatches.length / roomSize));
    roomPage = Math.min(roomPage, roomPages - 1);
    const visibleRooms = new Set(roomMatches.slice(roomPage * roomSize, (roomPage + 1) * roomSize));
    roomCards.forEach(card => { card.hidden = !visibleRooms.has(card); });
    const roomPager = root.querySelector('.room-pagination');
    roomPager.hidden = roomPages <= 1;
    roomPager.querySelector('[data-step="-1"]').disabled = roomPage === 0;
    roomPager.querySelector('[data-step="1"]').disabled = roomPage === roomPages - 1;
    roomPager.querySelector('output').textContent = `${roomPage + 1} / ${roomPages}`;
    root.querySelector('.catalog-no-results').hidden = matches.length > 0;
    pager.hidden = pages <= 1;
    pager.querySelector('[data-step="-1"]').disabled = page === 0;
    pager.querySelector('[data-step="1"]').disabled = page === pages - 1;
    pager.querySelector('output').textContent = `${page + 1} / ${pages}`;
  }
  const observer = new ResizeObserver(() => render());
  observer.observe(grid);
  render();
  return {
    filter: (reset = true) => render(reset),
    page: delta => { page = Math.max(0, page + delta); render(); },
    roomPage: delta => { roomPage = Math.max(0, roomPage + delta); render(); },
    dispose: () => observer.disconnect(),
  };
}
