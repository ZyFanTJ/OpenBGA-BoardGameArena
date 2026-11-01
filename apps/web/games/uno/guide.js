import {cardArt} from './art.js';
import {sheet,section,flow,choices,grid,badge,token,source} from '../guide-ui.js';
const card=(value,color='red')=>cardArt({value,color});
export function visualGuide(){return sheet('Mattel W2085 · 经典 108 张 · 2–10 人',
  flow([[card(7),'每人 7 张','先出完本轮手牌'],[card(3),'匹配出一张','同色 / 同数字 / 同符号'],[token('500'),'累计 500 分','短局以房间设置为准']])+
  section('看牌就能认出效果',grid([
    badge(card('skip'),'跳过 · 20 分','下家失去这次行动。'),badge(card('reverse','blue'),'反转 · 20 分','改变方向；双人局等同跳过。'),badge(card('draw2','green'),'+2 · 20 分','下家抽 2 张并跳过，不能叠加。'),badge(card('wild',null),'变色 · 50 分','选择下一种颜色，有同色牌也可出。'),badge(card('wild4',null),'+4 · 50 分','没有当前颜色牌时才合法；下家可以质疑。'),badge(card(7,'yellow'),'数字牌 · 牌面分','本轮胜者收取其他人剩余牌的总分。')]))+
  section('匹配示例',`<div class="rg-equation"><span class="rg-card-pair">${card(7)}${card(3)}</span>同红色 ✓ <span class="rg-card-pair">${card(7)}${card(7,'blue')}</span>同数字 ✓</div>`)+
  section('抽牌与 UNO',grid([badge(token('＋1'),'选择抽牌','抽后只能打刚抽的牌，或保留并结束。'),badge(token('UNO'),'出牌后只剩 1 张','随牌宣告或及时补喊；被抓漏喊罚抽 2 张。')]))+
  section('+4：接受，或选择质疑',choices([[card('wild4',null),'接受处罚','你抽 4 张并跳过'],[token('✓'),'质疑成功','对方抽 4 张，你继续'],[token('×'),'质疑失败','你抽 6 张并跳过']]))+
  source('https://service.mattel.com/instruction_sheets/W2085-Eng.pdf','官方规则书 · 第 1–3 页'));
}

export function fullGuide(){return `<div class="uno-guide"><small>CLASSIC · 108 CARDS</small><h2>UNO 玩法手卡</h2>${visualGuide()}<details class="rg-details"><summary>完整细则与线上约定</summary><p>每人 7 张，轮到你时打出一张同颜色、数字或符号的牌。万能牌可选颜色。先出完手牌赢得本轮。</p><h3>抽牌与罚牌</h3><p>可主动抽 1 张；抽牌后只能出刚抽的牌，也可保留。无牌可出时自动结束回合。+2 让下家抽两张并跳过；跳过和反转改变行动顺序。两人时反转等同跳过。罚牌不能叠加。</p><h3>+4 可以质疑</h3><p>仅当没有当前颜色的手牌时才能合法出 +4。被罚者可接受抽 4 张并跳过，或质疑并私下查看出牌者当时的剩余手牌。质疑成功，对方抽 4 张，你继续；失败，你抽 6 张并跳过。界面允许冒险出牌，可能被质疑。</p><h3>别忘记喊 UNO</h3><p>出牌后仅剩一张时须喊 UNO。出牌前可勾选随牌宣告；漏喊后可补喊，其他玩家也可在下一位开始行动前抓漏喊，罚抽两张。网络先收到的有效行动为准。</p><h3>计分与下一轮</h3><p>数字计牌面分；跳过、反转、+2 各 20 分；变色、+4 各 50 分。胜者得到其他人剩余牌的分数。末张 +2 / +4 先处理罚牌与质疑，再结算。标准先到 500 分胜；100 / 300 分是明确标注的线上短局。</p><p>初始 +4 重洗；初始变色由首位选色；初始功能牌照常生效。牌库用完保留顶牌，洗回其余弃牌。</p><p>本作采用经典个人计分赛，不含叠加、抢出、连出、7–0 换手或自定义牌。首轮庄家由服务器随机决定，此后轮庄。</p><a href="https://service.mattel.com/instruction_sheets/W2085-Eng.pdf" target="_blank" rel="noopener noreferrer">Mattel 官方经典版说明书 ↗</a><p class="uno-muted">卡面为本站原创矢量绘制，官方素材来源与版本差异见仓库 docs/uno-rules.md。</p></details></div>`;}
