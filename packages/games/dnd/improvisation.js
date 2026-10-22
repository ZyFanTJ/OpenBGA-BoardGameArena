// Public, bounded story consequences. The model proposes; the game owns resolution.
export const checkSkills = {
  athletics: { label: '运动', ability: 'str' }, acrobatics: { label: '杂技', ability: 'dex' },
  stealth: { label: '隐匿', ability: 'dex' }, sleightOfHand: { label: '巧手', ability: 'dex' },
  arcana: { label: '奥秘', ability: 'int' }, history: { label: '历史', ability: 'int' },
  investigation: { label: '调查', ability: 'int' }, nature: { label: '自然', ability: 'int' }, religion: { label: '宗教', ability: 'int' },
  animalHandling: { label: '驯兽', ability: 'wis' }, insight: { label: '洞悉', ability: 'wis' }, medicine: { label: '医药', ability: 'wis' },
  perception: { label: '察觉', ability: 'wis' }, survival: { label: '求生', ability: 'wis' },
  deception: { label: '欺瞒', ability: 'cha' }, intimidation: { label: '威吓', ability: 'cha' },
  performance: { label: '表演', ability: 'cha' }, persuasion: { label: '游说', ability: 'cha' },
};
export const emptyStory = () => ({ serial: 0, beats: [], threads: [], edges: [] });
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const keys = (v, allowed) => object(v) && Object.keys(v).every(k => allowed.includes(k));
const line = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v);
const skill = v => typeof v === 'string' && Object.hasOwn(checkSkills, v);
const difficulties = { easy: 10, moderate: 15, hard: 20 };

/** Strict schema: no state patches, rewards, new destinations or model-provided dice. */
export function readImprovisation(s, value, eligible) {
  if (!keys(value, ['title', 'skill', 'difficulty', 'reason', 'success', 'failure', 'effect', 'threadId', 'hook']) ||
    !line(value.title, 50) || !line(value.reason, 160) || !line(value.success, 240) || !line(value.failure, 240) ||
    !(value.skill === null || skill(value.skill)) || !Object.hasOwn(difficulties, value.difficulty)) return null;
  const effect = value.effect;
  if (!object(effect)) return null;
  let action = null;
  if (effect.kind === 'approach') {
    if (!keys(effect, ['kind', 'choiceId']) || typeof effect.choiceId !== 'string' || !value.skill || s.combat) return null;
    action = eligible.find(a => a.id === effect.choiceId && a.ability);
    if (!action) return null;
  } else if (effect.kind === 'influence') {
    if (!keys(effect, ['kind', 'skill']) || !(skill(effect.skill) || effect.skill === 'attack') || !value.skill) return null;
  } else if (effect.kind !== 'fiction' || !keys(effect, ['kind'])) return null;
  // In combat, even a distraction takes the character's action. Casual dialogue is a reply instead.
  if (s.combat && value.skill === null) return null;
  if (value.threadId != null && !s.story.threads.some(t => t.id === value.threadId && t.status === 'open')) return null;
  if (value.hook != null && (!keys(value.hook, ['title', 'prompt']) || !line(value.hook.title, 50) || !line(value.hook.prompt, 240))) return null;
  return { title: value.title.trim(), skill: value.skill, dc: action ? action.dc : difficulties[value.difficulty], reason: value.reason.trim(),
    success: value.success.trim(), failure: value.failure.trim(), effect: structuredClone(effect),
    threadId: value.threadId ?? null, hook: value.hook ? { title: value.hook.title.trim(), prompt: value.hook.prompt.trim() } : null };
}

export function edgeFor(s, skillId) { return s.story?.edges.find(x => x.sceneId === s.scene && x.skill === skillId) ?? null; }
export function consumeEdge(s, skillId) {
  const edge = edgeFor(s, skillId);
  if (edge) s.story.edges = s.story.edges.filter(x => x !== edge);
}
export function rememberConversation(s, playerId, intent, detail) {
  s.story.beats.push({ id: `story-${++s.story.serial}`, playerId, sceneId: s.scene, intent,
    title: '旅途中的交谈', detail, success: null, type: 'conversation' });
  s.story.beats = s.story.beats.slice(-80);
}

// Helpers mutate only the transition's cloned state, never the caller's input.
export function rememberImprovisation(s, playerId, intent, proposal, success, originScene) {
  const story = s.story, id = `story-${++story.serial}`;
  const detail = success ? proposal.success : proposal.failure;
  story.beats.push({ id, playerId, sceneId: originScene, intent, title: proposal.title, detail, success });
  story.beats = story.beats.slice(-80);
  if (proposal.effect.kind === 'influence') {
    // One circumstance per skill; it cannot stack into unbounded numerical bonuses.
    story.edges = story.edges.filter(x => !(x.sceneId === originScene && x.skill === proposal.effect.skill));
    story.edges.push({ sceneId: originScene, skill: proposal.effect.skill, mode: success ? 'advantage' : 'disadvantage', reason: detail });
    story.edges = story.edges.slice(-24);
  }
  if (proposal.threadId && success) story.threads.find(t => t.id === proposal.threadId).status = 'resolved';
  if (success && proposal.hook && story.threads.length < 12 && story.threads.filter(t => t.status === 'open').length < 3 &&
    !story.threads.some(t => t.title === proposal.hook.title)) {
    story.threads.push({ id: `thread-${story.serial}`, sceneId: originScene, ...proposal.hook, status: 'open' });
  }
  return detail;
}

export function storyView(s) {
  return { memories: structuredClone(s.story.beats.slice(-12)), threads: structuredClone(s.story.threads),
    edges: structuredClone(s.story.edges.filter(x => x.sceneId === s.scene)).map(x => ({ ...x, label: x.skill === 'attack' ? '攻击' : checkSkills[x.skill].label })) };
}
export function storyContext(s) {
  const recent = s.story.beats.slice(-8), here = s.story.beats.filter(x => x.sceneId === s.scene).slice(-8);
  return { ...storyView(s), memories: structuredClone([...new Map([...here, ...recent].map(x => [x.id, x])).values()]) };
}
