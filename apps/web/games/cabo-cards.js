/** Sprite indexes follow assets/cabo/reference-style/manifest.json (4 × 4). */
export function cardArt(value) {
  const index = value === null ? 14 : value;
  const underline = value === 6 || value === 9 ? 'underlined' : '';
  const ability = value >= 7 && value <= 8 ? 'PEEK' : value >= 9 && value <= 10 ? 'SPY' : value >= 11 && value <= 12 ? 'SWAP' : '';
  return `<span class="card-art tile-${index}" aria-hidden="true"></span>${value === null ? '' :
    `<span class="card-number ${underline}" aria-hidden="true">${value}</span><span class="card-number inverted ${underline}" aria-hidden="true">${value}</span>${ability ? `<span class="card-ability" aria-hidden="true">${ability}</span>` : ''}`}`;
}

/** Rotate the table around the viewer while preserving clockwise player order. */
export function seatPositions(players, viewerId) {
  const me = players.findIndex(p => p.id === viewerId);
  const positions = players.length === 2 ? ['south', 'north'] :
    players.length === 3 ? ['south', 'west', 'east'] : ['south', 'west', 'north', 'east'];
  return players.map((player, index) => ({ player, position: positions[(index - me + players.length) % players.length], color: index % 4 }));
}
