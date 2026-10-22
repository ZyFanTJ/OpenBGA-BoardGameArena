// Card text is a concise Chinese translation of the publisher's core rulebook.
export const roles = {
  spy: { name: '密探', phase: 1, text: '查看另一位玩家的家族牌。', art: 0 },
  mystic: { name: '秘术师', phase: 2, text: '查看另一位玩家的家族牌和随机一张未使用的忍者牌。', art: 1 },
  shapeshifter: { name: '易容师', phase: 3, text: '查看两位玩家的家族牌，可秘密交换。他们不能重看新身份。', art: 5 },
  gravedigger: { name: '掘墓人', phase: 3, text: '随机查看两张弃牌，选一张立即使用或保留到对应阶段。', art: 4 },
  troublemaker: { name: '挑拨者', phase: 3, text: '查看另一位玩家的家族牌，可将它公开。', art: 16 },
  spiritMerchant: { name: '灵魂商人', phase: 3, text: '查看他人的一枚荣誉或家族牌，可与其交换一枚荣誉。', art: 2 },
  thief: { name: '盗贼', phase: 3, text: '公开自己的家族牌，可偷取荣誉数量比你多的玩家的一枚荣誉。', art: 3 },
  judge: { name: '裁决者', phase: 3, text: '公开自己的家族牌，击杀一人。镜僧与殉道者无法反应。', art: 17 },
  blindAssassin: { name: '盲眼刺客', phase: 4, text: '选择另一位存活玩家并击杀。', art: 6 },
  shinobi: { name: '上忍', phase: 5, text: '先查看另一位玩家的家族牌，再决定是否击杀。', art: 7 },
  mirrorMonk: { name: '镜僧', phase: 0, text: '被盲眼刺客或上忍击杀时可反应，改为击杀攻击者。', art: 9 },
  martyr: { name: '殉道者', phase: 0, text: '被盲眼刺客或上忍击杀时可反应，获得一枚荣誉，仍会阵亡。', art: 18 },
  mastermind: { name: '幕后主使', phase: 6, text: '轮末若存活，你的家族获胜；若你是浪人，则没有家族获胜。', art: 10 },
};
export const phases = ['轮抽', '密探', '秘术师', '诡术师', '盲眼刺客', '上忍', '家族揭晓'];
export const houseNames = { crane: '鹤家', lotus: '莲家', ronin: '浪人' };
export function ninjaDeck() {
  return ['spy', 'mystic', 'blindAssassin', 'shinobi'].flatMap(role => Array.from({ length: 6 }, (_, i) => ({ id: `${role}-${i + 1}`, role, rank: i + 1 })))
    .concat(['shapeshifter', 'gravedigger', 'troublemaker', 'spiritMerchant', 'thief', 'judge'].map((role, i) => ({ id: role, role, rank: i + 1 })),
      ['mirrorMonk', 'martyr', 'mastermind'].map(role => ({ id: role, role, rank: null })));
}
