export function scoreRound(players, caller) {
  const sums = players.map(p => p.cards.reduce((sum, c) => sum + c.value, 0));
  const kamikaze = players.findIndex(p => p.cards.length === 4 &&
    p.cards.map(c => c.value).sort((a, b) => a - b).join(',') === '12,12,13,13');
  const minimum = Math.min(...sums);
  return players.map((p, i) => ({
    id: p.id, sum: sums[i],
    points: kamikaze >= 0 ? (i === kamikaze ? 0 : 50) :
      p.id === caller ? (sums[i] === minimum ? 0 : sums[i] + 10) : sums[i],
    kamikaze: i === kamikaze,
  }));
}

export function settleScores(players, results) {
  return players.map((p, i) => {
    let total = p.total + results[i].points;
    const reset = total === 100 && !p.resetUsed;
    if (reset) total = 50;
    return { ...p, total, resetUsed: p.resetUsed || reset };
  });
}
