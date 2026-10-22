export const COLORS = ['red', 'yellow', 'green', 'blue'];
export function makeDeck() {
  const cards = [];
  const add = (color, value) => cards.push({ id: `uno-${cards.length}`, color, value });
  for (const color of COLORS) {
    add(color, 0);
    for (const value of [1,2,3,4,5,6,7,8,9,'skip','reverse','draw2']) { add(color, value); add(color, value); }
  }
  for (let i = 0; i < 4; i++) { add(null, 'wild'); add(null, 'wild4'); }
  return cards;
}
export const points = card => typeof card.value === 'number' ? card.value : card.color ? 20 : 50;
export function shuffle(cards, random) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('随机源无效');
    const j = Math.floor(value * (i + 1)); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
