// Original adventure and simplified level-one archetypes; rules basis: SRD 5.2.1.
export const attribution = 'This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';
export const abilities = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
export const archetypes = {
  fighter: { title: '守卫', className: '战士原型', icon: '⚔', description: '铁甲与长剑。在前线保护同伴，擅长力量检定。', scores: { str: 16, dex: 12, con: 14, int: 10, wis: 13, cha: 8 }, hp: 12, ac: 18, hitDie: 10, skills: ['athletics', 'perception'], weapon: { name: '长剑', ability: 'str', die: 8 }, slots: 0 },
  rogue: { title: '斥候', className: '游荡者原型', icon: '◇', description: '轻装潜行，敏锐观察。擅长侦查、隐匿和调查。', scores: { str: 8, dex: 16, con: 14, int: 13, wis: 12, cha: 10 }, hp: 10, ac: 14, hitDie: 8, skills: ['stealth', 'investigation', 'perception'], weapon: { name: '短弓', ability: 'dex', die: 6 }, slots: 0 },
  cleric: { title: '守灯人', className: '牧师原型', icon: '✧', description: '带来疗愈与圣火。两次一环法术位可治疗伤口。', scores: { str: 13, dex: 12, con: 14, int: 8, wis: 16, cha: 10 }, hp: 10, ac: 16, hitDie: 8, skills: ['medicine', 'insight'], weapon: { name: '硬头锤', ability: 'str', die: 6 }, slots: 2 },
  wizard: { title: '符文学者', className: '法师原型', icon: '✦', description: '调查古老符文。火焰箭与两次魔法飞弹。', scores: { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 }, hp: 7, ac: 12, hitDie: 6, skills: ['arcana', 'investigation'], weapon: { name: '匕首', ability: 'dex', die: 4 }, slots: 2 },
};
export const scenes = {
  village: { title: '渡鸦溪镇', chapter: '序章', description: '入夜后，矿山的雾灯熄灭了。镇上的信使艾禾把一盏空灯放在桌上：三位修灯工仍在山里，钟声却从废井传来。你们答应在黎明前带他们回家。', exits: ['trail'] },
  trail: { title: '覆苔山径', chapter: '第一幕', description: '潮湿的石阶延伸进雾中。左侧有一条废弃水渠，右侧的灌木不断摇晃。远处的矿门上，一点灯火忽明忽暗。', exits: ['gate'] },
  gate: { title: '沉钟矿门', chapter: '第二幕', description: '一名惊惶的守矿人挡在铁门前。他紧握木矛，反复说着“钟没停，谁也不能进去”。门边的铜锁积满绿锈。', exits: ['vault'] },
  vault: { title: '雾灯之室', chapter: '终幕', description: '三位修灯工困在一道微光屏障后。石台上的雾灯倒扣着，灯座刻有月轮符号。一具披着锈甲的守卫倚在台边，空洞的面罩正缓缓抬起。', exits: [] },
};
// Outcomes and unrevealed locations stay server-side. Clients receive only current choices.
export const sceneActions = {
  village: [
    { id: 'investigate', label: '研究旧矿图', hint: '智力（调查）DC 10 · 可能找到另一条路', ability: 'int', skill: 'investigation', dc: 10, clue: 'waterway', success: '旧图显示，水渠可以绕过山径上的狼群。', failure: '旧图被雨水浸坏，暂时读不出捷径。' },
    { id: 'talk', label: '安抚信使，询问口令', hint: '魅力（游说）DC 10', ability: 'cha', skill: 'persuasion', dc: 10, clue: 'password', success: '艾禾想起守矿人的口令：“灯火归家”。', failure: '艾禾太过紧张，只记得守矿人害怕钟声。' },
    { id: 'travel', label: '出发前往矿山', hint: '推进到山径', next: 'trail' },
  ],
  trail: [
    { id: 'scout', label: '观察灌木里的动静', hint: '感知（察觉）DC 12 · 成功后下一次攻击有优势', ability: 'wis', skill: 'perception', dc: 12, clue: 'scouted', success: '你辨出狼群的伏击点，并向队友标记了安全站位。', failure: '风声盖过了灌木中的脚步。' },
    { id: 'sneak', label: '悄悄穿过山径', hint: '敏捷（隐匿）DC 12 · 失败会遭遇狼群', ability: 'dex', skill: 'stealth', dc: 12, next: 'gate', encounter: 'wolves', success: '你带着同伴避开狼群，抵达矿门。', failure: '碎石滚落，狼群循声扑来。' },
    { id: 'waterway', label: '沿旧水渠绕行', hint: '使用矿图线索，避开狼群', requires: 'waterway', next: 'gate' },
    { id: 'travel', label: '沿主路前进', hint: '进入狼群遭遇', encounter: 'wolves' },
  ],
  gate: [
    { id: 'talk', label: '说服守矿人开门', hint: '魅力（游说）DC 12 · 知道口令时有优势', ability: 'cha', skill: 'persuasion', dc: 12, next: 'vault', advantageClue: 'password', success: '守矿人终于放下木矛，为你们打开门。', failure: '他仍不肯让路，但没有主动攻击。' },
    { id: 'investigate', label: '研究门锁', hint: '智力（调查）DC 12 · 找到机械开关', ability: 'int', skill: 'investigation', dc: 12, clue: 'latch', success: '你发现铜锁底部有一枚松动的锁舌。', failure: '锁芯里全是锈屑，你没找到开关。' },
    { id: 'unlock', label: '拨动隐藏锁舌', hint: '使用门锁线索，进入矿井', requires: 'latch', next: 'vault' },
    { id: 'force', label: '推开卡住的侧门', hint: '力量（运动）DC 12 · 失败后守矿人会阻拦', ability: 'str', skill: 'athletics', dc: 12, next: 'vault', encounter: 'warden', success: '门轴发出低响，侧门被你推开。', failure: '侧门纹丝不动。守矿人举起木矛阻拦。' },
    { id: 'fight', label: '制服守矿人', hint: '开始战斗 · 本剧本战胜守矿人视为制服', encounter: 'warden' },
  ],
  vault: [
    { id: 'study', label: '解读灯座符文', hint: '智力（奥秘）DC 12 · 削弱最后的封印', ability: 'int', skill: 'arcana', dc: 12, clue: 'rune', success: '你读懂月轮的方向：先将灯转向镇子，再点燃灯芯。', failure: '符文闪烁，你暂时分不清正确朝向。' },
    { id: 'ritual', label: '重新点亮雾灯', hint: '感知 DC 12 · 有符文线索时 DC 10；失败唤醒锈甲守卫', ability: 'wis', dc: 12, win: true, encounter: 'sentinel', success: '雾灯重新亮起，屏障散开。三位修灯工终于走出矿室。', failure: '灯芯迸出火花，锈甲守卫从石台旁站起。' },
    { id: 'fight', label: '击败锈甲守卫，取回灯芯', hint: '开始最终战斗', encounter: 'sentinel' },
  ],
};
export const clueNames = { waterway: '旧水渠路线', password: '口令：灯火归家', scouted: '狼群伏击点', latch: '门锁的隐藏锁舌', rune: '月轮符文的方向' };
// Original, deliberately light encounters; these are not complete SRD monster stat blocks.
export const encounters = {
  wolves: { name: '雾径狼', hp: 9, ac: 12, attack: 3, die: 4, bonus: 1, dex: 2, next: 'gate' },
  warden: { name: '惊惶的守矿人', hp: 12, ac: 12, attack: 3, die: 4, bonus: 1, dex: 1, next: 'vault' },
  sentinel: { name: '锈甲守卫', hp: 16, ac: 13, attack: 4, die: 6, bonus: 1, dex: 0, next: null },
};
