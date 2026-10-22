import { ensure } from '../../platform/errors.js';
export const modifier = score => Math.floor((score - 10) / 2);
export function die(sides, random) {
  const n = random();
  ensure(Number.isFinite(n) && n >= 0 && n < 1, '随机数必须在 [0, 1) 内');
  return 1 + Math.floor(n * sides);
}
export function d20(bonus, random, advantage = false, disadvantage = false) {
  const dice = [die(20, random)];
  if (advantage !== disadvantage) dice.push(die(20, random));
  const natural = dice.length === 1 ? dice[0] : advantage ? Math.max(...dice) : Math.min(...dice);
  return { dice, natural, bonus, total: natural + bonus, mode: advantage === disadvantage ? 'normal' : advantage ? 'advantage' : 'disadvantage' };
}
export function attack(bonus, ac, random, advantage = false, disadvantage = false) {
  const roll = d20(bonus, random, advantage, disadvantage);
  return { ...roll, target: ac, hit: roll.natural === 20 || roll.natural !== 1 && roll.total >= ac, critical: roll.natural === 20 };
}
export function damage(sides, count, bonus, random) {
  const dice = Array.from({ length: count }, () => die(sides, random));
  return { dice, sides, bonus, total: Math.max(0, dice.reduce((a, b) => a + b, 0) + bonus) };
}
