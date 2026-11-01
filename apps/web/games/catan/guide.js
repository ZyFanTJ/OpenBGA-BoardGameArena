import {icon} from './icons.js';
import {sheet,section,flow,grid,badge,token,source} from '../guide-ui.js';
const names={wood:'木',brick:'砖',wool:'羊',grain:'粮',ore:'矿'};
const resources=cost=>Object.entries(cost).map(([r,n])=>`<span class="rg-resource">${icon(r)}${names[r]} ×${n}</span>`).join('');
export function visualGuide(){return sheet('CATAN · 2020 基础版 · 3–4 人 · 自己回合达到 10 分',
 flow([[icon('dice'),'掷骰生产','所有人收获；城市产出 ×2'],[icon('trade'),'交易 ⇄ 建造','可交替进行'],[token('10'),'检查胜利','自己的回合达到 10 分']])+
 section('建造费用手卡',`<table class="rg-costs"><thead><tr><th>建造</th><th>交给银行</th><th>效果</th></tr></thead><tbody>${[['road','道路',{wood:1,brick:1},'延伸路线'],['settlement','村庄',{wood:1,brick:1,wool:1,grain:1},'1 分'],['city','城市',{grain:2,ore:3},'升级村庄，合计 2 分'],['development','发展卡',{wool:1,grain:1,ore:1},'抽 1 张']].map(([id,title,cost,text])=>`<tr><th>${icon(id)} ${title}</th><td><div class="rg-resources">${resources(cost)}</div></td><td>${text}</td></tr>`).join('')}</tbody></table>`)+
 section('交易比例',grid([badge(icon('trade'),'银行 4 → 1','四份同种资源换一份其他资源。'),badge(icon('settlement'),'港口 3 → 1 / 2 → 1','普通港口任意同种三份；专用港口对应资源两份。')]))+
 section('掷出 7',flow([[token('>7'),'先弃资源','超过 7 张者弃一半，向下取整'],[icon('knight'),'移动强盗','换一块地形，阻断该地产出'],[token('−1'),'随机抢一张','从相邻有资源的对手中选一位']]))+
 section('奖励与发展卡',grid([badge(icon('road'),'最长道路 ＋2 分','至少 5 条连续道路；对手建筑可截断。'),badge(icon('knight'),'最大骑士军 ＋2 分','至少打出 3 张骑士；并列原持有者保留。'),badge(icon('development'),'每回合最多用 1 张','购买当回合不能用；胜利点卡例外。'),badge(icon('settlement'),'村庄保持间距','相邻交点不能有村庄或城市。')]))+
 source('https://www.catan.com/sites/default/files/2021-06/catan_base_rules_2020_200707.pdf','官方规则与 Almanac · 建造第 4–5 页'));
}

export function fullGuide(){return `<details class="ct-guide"><summary>玩法与建造指南</summary>${visualGuide()}<details class="rg-details"><summary>开局、强盗与发展卡细则</summary><p>在自己的回合达到 10 分获胜。村庄 1 分，城市 2 分，最长道路与最大骑士军各 2 分。胜利点发展卡秘密计分。</p><p>开局按顺序放一组村庄与道路，再倒序放第二组。第二个村庄获得相邻地形各一份资源。村庄之间至少隔一个交点。</p><p>掷骰后所有玩家收获对应地形的资源，城市收获两份。随后可自由交替交易与建造。数字下方的圆点越多，产出概率越高。</p><p>掷出 7 时，超过 7 张资源者弃掉一半（向下取整）；掷骰者移动强盗并从相邻玩家随机取一张资源。被强盗占据的地形不产出。</p><p>银行通常 4 换 1，普通港口 3 换 1，专用港口以对应资源 2 换 1。玩家交易只能与当前回合玩家成交，可用下方报价修改提议。</p><p>每回合最多使用一张发展卡，且不能使用本回合买入的卡（胜利点例外）。骑士可在掷骰前使用。修路免费放最多两条路，丰收取两份资源，垄断收取其他玩家全部指定资源。</p><p>最长连续道路至少 5 条；最大骑士军至少 3 张已使用骑士。同分时原持有者保留。对手村庄会截断道路。</p><a href="https://www.catan.com/sites/default/files/2021-06/catan_base_rules_2020_200707.pdf" target="_blank" rel="noopener noreferrer">官方基础版规则书 ↗</a></details></details>`;}
