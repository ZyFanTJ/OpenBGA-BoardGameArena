import { DIE, indexOf, neighbors, region, walk } from './board.js';

/** Public-board strategy. No stack order, hidden state, timers or transport access. */
export const marrakechBot = {
  observe: () => ({}),
  decide(view, playerId) {
    if (view.turnId !== playerId || view.phase === 'finished') return null;
    const me = view.players.find(p => p.id === playerId);
    if (view.phase === 'orient') {
      const cost = direction => DIE.reduce((sum, die) => {
        const pawn = walk({ ...view.pawn, direction }, die).pawn, index = indexOf(pawn.x, pawn.y), cell = view.board[index];
        const owner = view.players.find(p => p.id === cell?.ownerId);
        const due = owner && owner.id !== playerId && !owner.eliminated ? region(view.board, index).length : 0;
        return sum + due + (due > me.coins ? 100 : 0);
      }, 0);
      return { type: 'roll', direction: [...view.legal.directions].sort((a, b) => cost(a) - cost(b))[0] };
    }
    if (view.phase === 'place') {
      const value = cells => cells.reduce((sum, index) => {
        const covered = view.board[index];
        return sum + (covered?.ownerId === playerId ? -2 : covered ? 3 : 1)
          + neighbors(index).filter(n => view.board[n]?.color === view.nextColor).length * 1.5;
      }, 0);
      const best = [...view.legal.placements].sort((a, b) => value(b) - value(a))[0];
      return best ? { type: 'place', cells: best } : null;
    }
    return null;
  },
};
