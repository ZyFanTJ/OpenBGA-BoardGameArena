/** Marrakech geometry. Coordinates increase east/south; directions N,E,S,W. */
export const SIZE = 7;
export const DIE = [1, 2, 2, 3, 3, 4];
const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const indexOf = (x, y) => y * SIZE + x;
export const pointOf = index => ({ x: index % SIZE, y: Math.floor(index / SIZE) });
export function neighbors(index) {
  const { x, y } = pointOf(index);
  return vectors.map(([dx, dy]) => [x + dx, y + dy])
    .filter(([a, b]) => a >= 0 && a < SIZE && b >= 0 && b < SIZE).map(([a, b]) => indexOf(a, b));
}

/** The printed board rotated so the corner loops are NW and SE. Re-entry costs one step. */
export function step(pawn) {
  const { x, y, direction: d } = pawn, [dx, dy] = vectors[d];
  const nx = x + dx, ny = y + dy;
  if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) return { x: nx, y: ny, direction: d, via: [] };
  if (x === 0 && y === 0 && (d === 0 || d === 3)) {
    return { x, y, direction: d === 0 ? 1 : 2, via: d === 0 ? [{ x: 0, y: -.6 }, { x: -.6, y: -.6 }, { x: -.6, y: 0 }] : [{ x: -.6, y: 0 }, { x: -.6, y: -.6 }, { x: 0, y: -.6 }] };
  }
  if (x === 6 && y === 6 && (d === 1 || d === 2)) {
    return { x, y, direction: d === 1 ? 0 : 3, via: d === 1 ? [{ x: 6.6, y: 6 }, { x: 6.6, y: 6.6 }, { x: 6, y: 6.6 }] : [{ x: 6, y: 6.6 }, { x: 6.6, y: 6.6 }, { x: 6.6, y: 6 }] };
  }
  const oddPairs = d === 0 || d === 3;
  const value = d % 2 === 0 ? x : y;
  const paired = value + (value % 2 === (oddPairs ? 1 : 0) ? 1 : -1);
  const to = d % 2 === 0 ? { x: paired, y } : { x, y: paired };
  return { ...to, direction: (d + 2) % 4, via: [{ x: x + dx * .6, y: y + dy * .6 }, { x: to.x + dx * .6, y: to.y + dy * .6 }] };
}
export function walk(pawn, count) {
  const path = [];
  let current = pawn;
  for (let i = 0; i < count; i++) { current = step(current); path.push(current); }
  return { pawn: { x: current.x, y: current.y, direction: current.direction }, path };
}
export function region(board, start) {
  const color = board[start]?.color;
  if (color == null) return [];
  const found = new Set([start]), queue = [start];
  for (let i = 0; i < queue.length; i++) for (const n of neighbors(queue[i])) {
    if (!found.has(n) && board[n]?.color === color) { found.add(n); queue.push(n); }
  }
  return queue;
}
export function placements(board, pawn) {
  const occupied = indexOf(pawn.x, pawn.y), touching = new Set(neighbors(occupied)), result = [];
  for (let a = 0; a < 49; a++) for (const b of neighbors(a)) {
    if (a >= b || a === occupied || b === occupied || (!touching.has(a) && !touching.has(b))) continue;
    if (board[a] && board[a].rugId === board[b]?.rugId) continue;
    result.push([a, b]);
  }
  return result;
}
