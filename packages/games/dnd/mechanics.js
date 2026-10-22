import { abilities, archetypes } from './content.js';
import { modifier } from './dice.js';
import { adventureFor, publicScene, actionDC, hasFlags } from './adventures/index.js';
import { checkSkills, edgeFor } from './improvisation.js';

const skills = Object.fromEntries(Object.entries(checkSkills).map(([key, def]) => [key, def.label]));
/** A public explanation computed from authoritative rules, never supplied by the DM. */
export function describeCheck(s, id, choiceId, improvisation = null) {
  const spec = describe(s, id, choiceId, improvisation);
  if (!spec || spec.kind === 'effect') return spec;
  const succeeds = n => spec.kind === 'attack' ? n === 20 || n !== 1 && n + spec.bonus >= spec.target
    : spec.kind === 'save' ? n + spec.bonus < spec.target : n + spec.bonus >= spec.target;
  let wins = 0;
  for (let a = 1; a <= 20; a++) for (let b = 1; b <= 20; b++) {
    if (succeeds(spec.mode === 'advantage' ? Math.max(a, b) : spec.mode === 'disadvantage' ? Math.min(a, b) : a)) wins++;
  }
  return { ...spec, successChance: wins / 4 };
}
function describe(s, id, choiceId, improvisation) {
  const c = s.players.find(p => p.id === id)?.character;
  if (!c) return null;
  const a = archetypes[c.type], [kind, targetId] = choiceId.split(':');
  const abilityTerm = key => ({ label: abilities[key], score: c.scores[key], bonus: modifier(c.scores[key]) });
  const check = (ability, skill, dc, advantage = false) => {
    const terms = [abilityTerm(ability)];
    const trained = a.skills.includes(skill);
    terms.push({ label: trained ? `${skills[skill]}熟练` : skill ? `${skills[skill]}未受训` : '无额外熟练', bonus: trained ? 2 : 0 });
    const edge = edgeFor(s, skill), positive = advantage || edge?.mode === 'advantage', negative = edge?.mode === 'disadvantage';
    const mode = positive && !negative ? 'advantage' : negative && !positive ? 'disadvantage' : 'normal';
    return { kind: 'check', label: `${abilities[ability]}${skill ? `（${skills[skill]}）` : ''}检定`, dice: 'd20', sides: 20, count: mode === 'normal' ? 1 : 2,
      terms, bonus: terms.reduce((n, t) => n + t.bonus, 0), target: dc, targetLabel: '难度等级', mode,
      circumstance: edge?.reason ?? null,
      rule: '骰点 + 属性调整值 + 适用熟练 ≥ DC 即成功。自然 1 / 20 不自动决定普通检定。' };
  };
  if (improvisation?.skill) {
    const proposal = improvisation;
    const action = proposal.effect.kind === 'approach' ? adventureFor(s).actions[s.scene].find(x => x.id === proposal.effect.choiceId) : null;
    return { ...check(checkSkills[proposal.skill].ability, proposal.skill, proposal.dc, !!action?.advantageClue && s.clues.includes(action.advantageClue)),
      title: proposal.title, intent: s.pendingCheck?.intent ?? '', reason: proposal.reason,
      stakes: { success: proposal.success, failure: proposal.failure },
      consequence: action ? `成功推进「${action.label}」。失败沿用该障碍的后果${action.encounter ? '，可能进入战斗' : ''}${action.failureDamage ? `，最多损失 ${action.failureDamage} HP` : ''}。` : proposal.effect.kind === 'influence' ? `影响本场景下一次${proposal.effect.skill === 'attack' ? '攻击' : skills[proposal.effect.skill] + '检定'}：成功获得优势；失败获得劣势。` : '结果会记入故事；不直接改变生命、物品或主线完成状态。' };
  }
  if (kind === 'deathSave') return { kind: 'death', label: '死亡豁免', dice: 'd20', sides: 20, count: 1, bonus: 0, terms: [], target: 10, targetLabel: '成功门槛', mode: 'normal', rule: '自然 1 记两次失败；20 恢复 1 HP。累计三次成功稳定，三次失败死亡。' };
  if (kind === 'stabilize') return check('wis', 'medicine', 10);
  if (['potion', 'cure', 'rest', 'missile'].includes(kind)) {
    const sides = kind === 'potion' || kind === 'missile' ? 4 : kind === 'cure' ? 8 : a.hitDie;
    const count = kind === 'potion' || kind === 'cure' ? 2 : 1;
    const terms = kind === 'cure' ? [abilityTerm('wis')] : kind === 'rest' ? [abilityTerm('con')] : [{ label: kind === 'potion' ? '药水加值' : '每枚飞弹', bonus: kind === 'potion' ? 2 : 1 }];
    const bonus = terms.reduce((n, t) => n + t.bonus, 0);
    return { kind: 'effect', label: { potion: '治疗药水', cure: '治疗伤口', rest: '短休恢复', missile: '魔法飞弹' }[kind], dice: `${count}d${sides}`, sides, count, terms, bonus, target: null, targetLabel: '', mode: 'normal', multiplier: kind === 'missile' ? 3 : 1,
      rule: kind === 'missile' ? '三枚飞弹自动命中同一目标，(1d4 + 1) × 3；消耗一个法术位。' : kind === 'rest' ? '花费一枚生命骰，至少恢复 1 HP，不超过最大 HP。' : `消耗${kind === 'potion' ? '一瓶药水' : '一个法术位'}，恢复 ${count}d${sides} + ${bonus} HP，不超过最大 HP。` };
  }
  if (s.combat && ['attack', 'cantrip'].includes(kind)) {
    const enemy = s.combat.enemies.find(e => e.id === targetId);
    if (!enemy) return null;
    if (kind === 'cantrip' && c.type === 'cleric') return { kind: 'save', label: `${enemy.name} · 敏捷豁免`, dice: 'd20', sides: 20, count: 1, terms: [{ label: '敌人敏捷', bonus: enemy.dex }], bonus: enemy.dex, target: 10 + modifier(c.scores.wis), targetLabel: '你的法术 DC', mode: 'normal', rule: `法术 DC = 8 + 熟练 2 + 感知 ${modifier(c.scores.wis)}。敌人未达到 DC 才受 1d8 光耀伤害。` };
    const terms = [abilityTerm(kind === 'cantrip' ? 'int' : a.weapon.ability), { label: kind === 'cantrip' ? '施法熟练' : '武器熟练', bonus: 2 }];
    const edge = edgeFor(s, 'attack'), positive = c.advantage || edge?.mode === 'advantage', negative = edge?.mode === 'disadvantage';
    const mode = positive && !negative ? 'advantage' : negative && !positive ? 'disadvantage' : 'normal';
    return { kind: 'attack', label: `${kind === 'cantrip' ? '火焰箭' : a.weapon.name}攻击`, dice: 'd20', sides: 20, count: mode === 'normal' ? 1 : 2, terms, bonus: terms.reduce((n, t) => n + t.bonus, 0), target: enemy.ac, targetLabel: `${enemy.name} · AC`, mode, circumstance: edge?.reason ?? null, rule: '总值达到 AC 命中。自然 20 必中并掷两组伤害骰；自然 1 未命中。' };
  }
  const action = adventureFor(s).actions[s.scene]?.find(a => a.id === choiceId);
  if (!action?.ability) return null;
  const advantage = !!action.advantageClue && s.clues.includes(action.advantageClue);
  return { ...check(action.ability, action.skill, actionDC(s, action), advantage),
    advantageReason: advantage ? adventureFor(s).clueNames[action.advantageClue] : null,
    difficultyReason: action.dcFlag && s.flags[action.dcFlag] ? `${adventureFor(s).flagNames[action.dcFlag]} · DC ${action.dc} → ${action.raisedDC}` : null };
}

function mistlightWorld(s) {
  const ids = ['village', 'trail', 'gate', 'vault'], index = ids.indexOf(s.scene);
  const names = ['渡鸦溪镇', '覆苔山径', '沉钟矿门', '雾灯之室'];
  const won = !!s.outcome?.won;
  return {
    locations: ids.map((id, i) => ({ id, title: i <= index ? names[i] : '尚未探索', status: i === index ? 'current' : i < index ? 'visited' : 'hidden', x: [13, 38, 65, 87][i], y: [68, 37, 59, 27][i] })),
    route: s.clues.includes('waterway') ? '已发现水渠捷径，可以避开山径狼群。' : '沿山路寻找矿井。探索可能发现其他路线。',
    quest: { title: '让灯火回家', status: s.outcome ? won ? 'completed' : 'failed' : 'active', objectives: [
      { text: '接下艾禾的委托', done: s.phase !== 'characters' }, { text: '穿过雾径，抵达矿门', done: index >= 2 },
      { text: index >= 3 ? '进入雾灯之室' : '深入矿井，寻找修灯工', done: index >= 3 }, { text: '营救三位修灯工，点亮雾灯', done: won },
    ] },
    entities: s.scene === 'village' ? [{ name: '信使艾禾', state: s.clues.includes('password') ? '已告知口令' : s.attempted.includes('village:talk') ? '未想起口令' : '焦虑，等待援助' }, { name: '旧矿图', state: s.clues.includes('waterway') ? '水渠路线已标记' : s.attempted.includes('village:investigate') ? '已研究，未辨明路线' : '可以研究' }]
      : s.scene === 'trail' ? [{ name: '雾径狼群', state: s.combat ? '正在交战' : s.clues.includes('scouted') ? '伏击点已侦明' : '动静未明' }, { name: '旧水渠', state: s.clues.includes('waterway') ? '路线已知' : '需要路线线索' }]
        : s.scene === 'gate' ? [{ name: '守矿人', state: s.combat ? '正在阻拦队伍' : '惊惶，拒绝让路' }, { name: '矿门', state: s.clues.includes('latch') ? '隐藏锁舌已发现' : '紧闭' }]
          : [{ name: '三位修灯工', state: won ? '已获救' : '困在屏障后' }, { name: '雾灯', state: won ? '已点亮' : s.clues.includes('rune') ? '点灯方法已知' : '倒扣在石台上' }],
    rules: 'SRD 5.2.1 · 精简短篇',
  };
}

export function worldView(s) {
  const a = adventureFor(s);
  if (a.id === 'mistlight') return { ...mistlightWorld(s), title: a.setting, developments: [] };
  const visible = new Set(s.visited), scene = a.scenes[s.scene];
  visible.add(s.scene);
  // Show only visited locations. Neighbour names and unrevealed routes are not a spoiler payload.
  const locations = Object.entries(a.scenes).map(([id, def], i) => ({ id: visible.has(id) ? id : 'unknown-' + i, title: visible.has(id) ? def.title : '尚未探索', status: id === s.scene ? 'current' : visible.has(id) ? 'visited' : 'hidden', x: def.x, y: def.y }));
  const edges = [];
  for (const [from, def] of Object.entries(a.scenes)) if (visible.has(from)) for (const to of def.exits) if (visible.has(to) && !edges.some(e => e.from === to && e.to === from)) edges.push({ from, to });
  const objectives = a.objectives.map(o => ({ text: o.text, done: !!(o.won ? s.outcome?.won : o.visit ? s.visited.includes(o.visit) : o.clue ? s.clues.includes(o.clue) : o.flags ? hasFlags(s, o.flags) : o.anyFlags ? o.anyFlags.some(k => s.flags[k]) : s.phase !== 'characters') }));
  return { title: a.setting, locations, edges, route: '已走过的路可以回访。线索、获救者与行动后果会保留。',
    quest: { title: a.quest, status: s.outcome ? s.outcome.partial ? 'partial' : s.outcome.won ? 'completed' : 'failed' : 'active', objectives },
    entities: publicScene(s).entities, developments: Object.entries(a.flagNames).filter(([key]) => s.flags[key]).map(([,label]) => label), rules: 'SRD 5.2.1 · 章节改编' };
}
