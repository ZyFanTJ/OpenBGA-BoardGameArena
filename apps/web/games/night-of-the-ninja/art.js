export function illustration(tile, extra = '') {
  return `<span class="nn-art nn-art-${tile} ${extra}" aria-hidden="true"></span>`;
}
export const houseNames = { crane: '鹤家', lotus: '莲家', ronin: '浪人' };
export function houseLabel(house) { return house ? `${houseNames[house.house]}${house.rank ? ` · ${house.rank}` : ''}` : '身份未公开'; }
export const phaseNames = ['', '密探', '秘术师', '诡术师', '盲眼刺客', '上忍'];
