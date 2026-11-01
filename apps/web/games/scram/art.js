export const abilities = {1:'无技能',2:'无技能',3:'无技能',4:'无技能',5:'查看 1 张',6:'查看 2 张',7:'翻开 1 张',8:'翻开 2 张',9:'弃 2 张 · 放入 9',10:'弃掉 1 张',11:'交换 2 张',12:'看 2 张 · 可交换',13:'放入任意营地','=':'配对任意数字'};
export function cardArt(value) {
  const hidden = value === null || value === undefined;
  const tile = hidden ? 7 : value === '=' ? 7 : (value-1)%7;
  return `<span class="sc-card-art sc-art-${tile}"></span>${hidden ? '<span class="sc-card-back">☾<small>SCRAM!</small></span>' : `<strong class="sc-value">${value}</strong><span class="sc-card-caption">${abilities[value]}</span>`}`;
}
