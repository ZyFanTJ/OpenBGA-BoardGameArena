import {escapeHtml as e} from '../../ui.js';
import {sheet,section,flow,grid,badge,token} from '../guide-ui.js';
import {illustration} from './art.js';
const art=n=>`<span class="rg-portrait">${illustration(n)}</span>`;
export function visualGuide(){return sheet('Brotherwise · 2020 基础版 · 4–11 人',
 flow([[token('3 → 1'),'选第一张','三选一，余下两张传左边'],[token('2 → 1'),'选第二张','再选一，最后一张暗弃'],[token('10'),'轮末看荣誉','有人达 10 分后比较总分']])+
 section('夜幕行动顺序',flow([[art(0),'密探','看家族'],[art(1),'秘术师','看家族与随机技能'],[art(5),'诡术师','按卡牌效果'],[art(6),'盲眼刺客','直接击杀'],[art(7),'上忍','先看身份，再决定击杀']]))+
 section('两种数字，不要混淆',grid([badge(token('1'),'家族地位','1 最高；结算时比较双方最优幸存者。'),badge(token('1 → 6'),'技能顺位','同一阶段，按卡牌 1 至 6 顺序行动。')]))+
 `<div class="rg-note">胜方家族全员领奖，阵亡者也包括在内；浪人存活即可领奖。身份每轮重洗，荣誉累计保留。镜僧、殉道者属于反应牌，完整角色效果见下方。</div>`);
}

export function fullGuide(reference) {
    return `<div class="nn-reference"><small>NIGHT OF THE NINJA</small><h2>忍者之夜 · 玩法手卡</h2>${visualGuide()}<details class="rg-details"><summary>轮次、胜负与情报细则</summary><p>4–11 人 · 每轮换身份 · 个人荣誉累计至 10 分</p><ol><li><b>轮抽两张技能</b>每人三张，选一张传左边；再从传来的两张选一张，余牌暗弃。</li><li><b>夜幕行动</b>密探 → 秘术师 → 诡术师 → 盲眼刺客 → 上忍。各阶段同时决定亮哪些牌，再按 1 至 6 使用技能。跳过的牌不能补打。</li><li><b>家族揭晓</b>只揭晓幸存者；1 是最高身份，比较双方最优存活身份，若相同继续比下一位。胜方全员领一枚荣誉，包括阵亡者。完全平手则每位幸存者领一枚。</li><li><b>浪人与胜利</b>浪人存活便领一枚。轮末检查 10 分，最高总分者胜，同分共享胜利。</li></ol><p>你可以聊天、说谎或分享情报，阵亡后仍可发言。旧情报是当时的观察，易容师交换后不能自行重看身份。</p></details><h3>角色效果速查</h3><div class="nn-role-reference">${Object.entries(reference).map(([role, def]) => `<article>${illustration(def.art)}<div><b>${def.name}</b><small>${e(def.text)}</small></div></article>`).join('')}</div><p class="nn-adaptation">线上适配：同时提交后统一亮牌；荣誉池采用 36 枚，2 / 3 / 4 分各 12 枚。公开规则书未列实体荣誉频数，故未宣称此配比为官方配比。完整边界与来源见仓库规则文档。</p><p><a href="https://www.brotherwisegames.com/night-of-the-ninja" target="_blank" rel="noopener noreferrer">出版方游戏页面</a> · <a href="https://www.brotherwisegames.com/s/NightoftheNinjaCoreRulebook.pdf" target="_blank" rel="noopener noreferrer">官方规则书</a> · <a href="https://www.brotherwisegames.com/s/NightOftheNinjaFAQ.pdf" target="_blank" rel="noopener noreferrer">官方 FAQ</a></p></div>`;
  }
