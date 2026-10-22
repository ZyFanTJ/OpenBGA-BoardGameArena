import { phaseNames } from './art.js';

// Read only public parts of a player's projection. Never inspect pack, hand, intel or pending choices.
const publicCard = (s, actorId, role) => {
  const active = s.active;
  if (active?.playerId === actorId && active.card.role === role) return { ...active.card };
  return [...(s.players.find(p => p.id === actorId)?.played ?? [])].reverse().find(c => c.role === role) ?? null;
};
export function publicEvent(event, s) {
  const role = event.type === 'reaction' ? event.choice === 'accept' ? null : event.choice : event.role;
  return { kind: event.type, actorId: event.actorId, targetIds: event.targetId ? [event.targetId] : [],
    role, choice: event.choice, card: role ? publicCard(s, event.actorId, role) : null };
}
function addedEvents(before, after) {
  const old = before.log ?? [], next = after.log ?? [];
  for (let overlap = Math.min(old.length, next.length); overlap >= 0; overlap--) {
    if (JSON.stringify(old.slice(old.length - overlap)) === JSON.stringify(next.slice(0, overlap))) return next.slice(overlap);
  }
  return [];
}
export function ninjaCues(before, after) {
  if (!before) return [];
  if (before.round !== after.round) return [{ kind: 'deal', step: 1 }];
  if (after.phase === 'draft' && before.draftStep !== after.draftStep) return [{ kind: 'deal', step: after.draftStep }];
  const events = addedEvents(before, after);
  const cues = events.filter((event, i) => !(event.type === 'ability' && events[i + 1]?.type === 'attack'
    && events[i + 1].actorId === event.actorId && events[i + 1].targetId === event.targetId)).map(event => publicEvent(event, after));
  const revealed = after.players.filter(p => p.house && !before.players.find(b => b.id === p.id)?.house);
  if (['roundEnd', 'finished'].includes(after.phase) && before.phase !== after.phase) {
    cues.push({ kind: 'round', targetIds: after.roundResult?.awarded ?? [] }); return cues;
  }
  if (revealed.length) cues.push({ kind: 'reveal', actorId: before.active?.playerId, targetIds: revealed.map(p => p.id) });
  const privateRole = ['shapeshifter', 'gravedigger'].includes(after.pending?.kind);
  if (privateRole && before.phase === 'act' && !cues.length) cues.push({ kind: 'ability', actorId: after.active.playerId, targetIds: [], role: after.active.card.role, card: { ...after.active.card } });
  if (before.phase === 'decision' && !['decision', 'react'].includes(after.phase) && !cues.length) {
    cues.push({ kind: 'complete', actorId: before.active?.playerId, targetIds: [], role: before.active?.card.role, card: before.active ? { ...before.active.card } : null });
  }
  if (before.phase === 'act' && before.active?.card.role === 'thief' && after.phase !== 'act' && !cues.length) {
    cues.push({ kind: 'complete', actorId: before.active.playerId, targetIds: [], role: 'thief', card: { ...before.active.card } });
  }
  if (after.active && `${after.active.playerId}:${after.active.card.id}` !== `${before.active?.playerId}:${before.active?.card.id}`) {
    cues.push({ kind: 'play', actorId: after.active.playerId, targetIds: [], role: after.active.card.role, card: { ...after.active.card } });
  } else if (after.phase === 'announce' && before.nightPhase !== after.nightPhase) cues.push({ kind: 'phase', phase: after.nightPhase });
  return cues;
}
export function currentNinjaAction(s) {
  if (s.active) {
    const last = s.log.at(-1), card = { ...s.active.card };
    const event = ['decision', 'react'].includes(s.phase) && last?.actorId === s.active.playerId && last.role === card.role ? publicEvent(last, s) : null;
    return event ?? { kind: 'play', actorId: s.active.playerId, targetIds: [], role: card.role, card };
  }
  if (['roundEnd', 'finished'].includes(s.phase)) return { kind: 'round', targetIds: s.roundResult?.awarded ?? [] };
  if (s.phase === 'draft') return { kind: 'deal', step: s.draftStep };
  return { kind: 'phase', phase: s.nightPhase };
}
export function describeNinjaAction(cue, s, name) {
  const actor = name(cue.actorId), target = cue.targetIds?.map(name).join('、'), role = s.reference[cue.role]?.name ?? '';
  if (cue.kind === 'play') return { label: '打出忍者牌', title: `${actor} 亮出${role}${cue.card?.rank ? ` · ${cue.card.rank}` : ''}`, detail: s.reference[cue.role]?.text ?? '', tone: 'gold' };
  if (cue.kind === 'attack') return { label: '发起击杀', title: `${actor} → ${target}`, detail: cue.role === 'judge' ? '裁决者直接击杀，无法使用反应牌。' : `${role}出手，等待目标选择反应。`, tone: 'danger' };
  if (cue.kind === 'reaction') {
    if (cue.choice === 'mirrorMonk') return { label: '镜僧 · 反杀', title: `${actor} 反杀 ${target}`, detail: '镜僧存活，攻击者阵亡。', tone: 'mirror' };
    if (cue.choice === 'martyr') return { label: '殉道者 · 反应', title: `${actor} 获得一枚荣誉后阵亡`, detail: '荣誉分值保持隐藏。阵亡后仍可聊天。', tone: 'gold' };
    return { label: '击杀结算', title: `${actor} 已阵亡`, detail: '身份保持原有公开状态，仍可随家族获奖。', tone: 'danger' };
  }
  if (cue.kind === 'ability') return { label: `${role} · 技能发动`, title: target ? `${actor} → ${target}` : `${actor} 正在使用${role}`, detail: ['spy', 'mystic', 'shinobi', 'spiritMerchant', 'shapeshifter', 'gravedigger'].includes(cue.role) ? '正在处理私密情报，结果仅行动者可见。' : s.reference[cue.role]?.text ?? '', tone: 'gold' };
  if (cue.kind === 'complete') return { label: '技能处理完毕', title: `${actor} 完成${role}行动`, detail: '继续按牌面顺位行动，私密选择保持隐藏。', tone: 'gold' };
  if (cue.kind === 'reveal') return { label: '家族身份公开', title: `${target} 亮出家族牌`, detail: '公开的身份现在可以在玩家座位上查看。', tone: 'gold' };
  if (cue.kind === 'round') return { label: '天明 · 本轮结算', title: s.phase === 'finished' ? `${s.winners.map(name).join('、')} 获胜` : '夜幕结束，家族揭晓', detail: target ? `${target} 获得荣誉。` : '本轮没有玩家获得荣誉。', tone: 'gold' };
  if (cue.kind === 'deal') return { label: `轮抽 ${cue.step} / 2`, title: cue.step === 1 ? '收下三张牌，选一张传左边' : '余牌已经传来，再选一张', detail: '每位玩家最终保留两张技能牌，尚未公开的牌保持隐藏。', tone: 'gold' };
  return { label: '夜幕行动', title: `${phaseNames[cue.phase]}阶段 · 同时决定亮牌`, detail: '所有人锁定选择后统一亮牌，按 1 → 6 顺序发动技能。', tone: 'gold' };
}
