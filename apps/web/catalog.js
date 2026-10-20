/** A single shelf of games, filtered and paged at the current card width. */
export function createCatalog(root) {
  const grid = root.querySelector('.moon-game-grid');
  // Cards start hidden so measuring the grid cannot fetch every cover first.
  const cards = [...grid.querySelectorAll('[data-game-search]')];
  const pager = root.querySelector('.catalog-pagination');
  let page = 0, pageSize = 1;
  function render(reset = false) {
    if (reset) page = 0;
    const query = root.querySelector('#lobby-search')?.value.trim().toLowerCase() ?? '';
    const category = root.querySelector('[data-filter][aria-pressed=true]')?.dataset.filter ?? '全部';
    pageSize = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    const matches = cards.filter(card => card.dataset.gameSearch.includes(query) && (category === '全部' || card.dataset.category === category));
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    page = Math.min(page, pages - 1);
    const visible = new Set(matches.slice(page * pageSize, (page + 1) * pageSize));
    cards.forEach(card => { card.hidden = !visible.has(card); });
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
    dispose: () => observer.disconnect(),
  };
}
