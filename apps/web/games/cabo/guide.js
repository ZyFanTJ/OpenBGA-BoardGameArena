import {sheet,section,choices,token,source} from '../guide-ui.js';
export function visualGuide(expert){return sheet('2019 英文第二版 · 累计罚分越低越好',
 section('每回合三选一',choices([[token('▧'),'牌库抽 1 张','换牌，或弃掉使用 7–12 能力'],[token('↥'),'取弃牌堆顶','必须换入自己的牌列'],[token('CABO'),'呼叫结束','本回合不抽；其他人各行动一次']]))+
 section('多换一示例',`<div class="rg-equation">${token('5')}${token('5')} → ${token('2')}<span>两张同点数换成一张</span></div><p>选错不能减牌；原牌保留并加入抽到的牌。选 3 张以上失败，还需罚抽 1 张（牌库有牌时）。</p>`)+
 `<div class="rg-note">${expert?'本房间专家模式：所有牌保持盖住，仍按累计分结束；官网另列的四轮变体未启用。':'标准模式：弃牌堆换入与失败后保留的牌公开；牌库正常换入的牌盖住。'}</div>`+
 source('https://boardgamegeek.com/filepage/183443/cabo-second-edition-official-rules','第二版官方规则文件条目')+source('https://beziergames.com/pages/cabo','出版方专家变体说明'));
}
