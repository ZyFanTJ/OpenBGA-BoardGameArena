/** Small shared interface icons; game artwork remains separate raster assets. */
const paths = {
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="1"/><path d="M16 8V3H3v13h5"/>',
  crown: '<path d="m3 5 4 5 5-7 5 7 4-5-2 14H5zM5 22h14"/>',
  home: '<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3z"/>',
  room: '<path d="M5 21V5a7 7 0 0 1 14 0v16M9 21v-7h6v7M9 7h6M9 10h6"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-4a7 7 0 0 1 14 0v4M16 4a3 3 0 0 1 0 6M20 21v-5a5 5 0 0 0-3-4"/>',
  chart: '<path d="M4 21V12h3v9M11 21V7h3v14M18 21V3h3v18"/>',
  bag: '<rect x="4" y="7" width="16" height="14" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  bell: '<path d="M5 9a7 7 0 0 1 14 0v7l2 3H3l2-3zM9 22h6M12 0v2"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5zM12 0v3M12 21v3M0 12h3M21 12h3"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01"/>',
  heart: '<path d="M12 21 3 12C-3 3 8-1 12 6c4-7 15-3 9 6z"/>',
  play: '<path d="m9 5 11 7-11 7z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  arrow: '<path d="M3 12h18m-6-6 6 6-6 6"/>',
  refresh: '<path d="M21 4v6h-6M3 20v-6h6M4 9a8 8 0 0 1 14-5l3 6M3 14l3 6a8 8 0 0 0 14-5"/>',
  plus: '<path d="M12 3v18M3 12h18"/>',
};
export const icon = name => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.dice}</svg>`;
