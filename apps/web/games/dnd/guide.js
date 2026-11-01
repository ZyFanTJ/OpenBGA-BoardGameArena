import {escapeHtml as e} from '../../ui.js';
import {sheet,section,flow,grid,badge,token,source} from '../guide-ui.js';
const die=n=>`<svg viewBox="0 0 60 60" aria-hidden="true"><path d="m30 3 25 15v27L30 58 5 45V18z" fill="#25444c" stroke="#e5c887" stroke-width="2"/><path d="m30 3-15 35h30L30 3M5 18l10 20-10 7m50-27L45 38l10 7M15 38l15 20 15-20" fill="none" stroke="#e5c887" opacity=".6"/><text x="30" y="32" text-anchor="middle" fill="#fff0c9" font-size="17">${n}</text></svg>`;
export function visualGuide(){return sheet('SRD 5.2.1 · 本站精简冒险，不是完整 D&D',
 flow([[token('✎'),'描述行动','选行动或告诉 DM 你的办法'],[token('?'),'确认后果','先看难度、加值与风险'],[die('d20'),'确认投骰','规则结算后再继续故事']])+
 section('检定怎么算',`<div class="rg-equation">${die('d20')} <span>d20 骰点 ＋ 属性调整 ＋ 适用熟练 ≥ 难度</span></div><p>本作一级角色的适用熟练加值为 +2。示例：骰点 12 ＋ 属性 3 ＋ 熟练 2 ＝ 17，通过难度 15。</p>`)+
 section('优势与劣势',grid([badge(die('↑'),'优势：两骰取高','例：7 与 16，使用 16。'),badge(die('↓'),'劣势：两骰取低','例：7 与 16，使用 7。')]))+
 section('攻击与生存',grid([badge(token('20'),'攻击自然 20','必中，并多掷一组伤害骰；普通属性检定不自动成功。'),badge(token('1'),'攻击自然 1','未命中；普通属性检定不自动失败。'),badge(token('HP'),'0 HP 与死亡豁免','倒地不等于死亡；关注界面上的死亡豁免与治疗行动。'),badge(token('＋'),'治疗与休息','药水占用一次行动；短休及法术资源以角色面板为准。')]))+
 source('https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf','官方 SRD · 第 5–8、13–18 页'));
}

export function fullGuide(s) {
    return `<details class="dnd-guide"><summary>玩法与规则范围 <span>SRD 5.2.1 · 精简冒险</span></summary><div>${visualGuide()}<details class="rg-details"><summary>玩法范围、线上简化与内容授权</summary><p>先创建一位角色。轮到你时，可以点击行动，或用一句话告诉 DM 你想做什么。行动需要检定时，服务器投掷 d20，加上属性调整值和适用的 +2 熟练加值，再与难度比较。</p><p>优势取两枚 d20 的高值，劣势取低值。攻击自然 20 必中并增加一组伤害骰，自然 1 未命中；普通属性检定没有自动成功或失败。战斗按先攻行动，敌人的行动自动结算。</p><p>首版提供四个简化一级角色原型、普通攻击、火焰箭、圣火术、魔法飞弹、治疗伤口、药水、闪避、短休和死亡豁免。暂未实现完整职业特性、专长、移动距离、附赠动作、反应、专注与升级。药水占一次行动；遭遇后倒地的非死亡队友恢复 1 HP；全队倒地视为冒险失败。以上为本剧本的明确简化。</p><p>本次游玩「${e(s.adventure.title)}」，使用 SRD 5.2.1 的规则子集。你可以自由提出新的办法。DM 会说明检定、成功与失败的后果，再由你决定是否掷骰；新办法可以推进眼前目标，创造优势，也可以留下关系、承诺与衍生支线。在故事面板可回看这些变化。生命、物品与主线结果仍以规则裁定为准。你的私密背景仅自己可见，不发送给模型。AI 模式会将当前场景、角色名和公开行动日志发送给房主部署的模型服务。</p><a href="https://www.dndbeyond.com/srd" target="_blank" rel="noopener noreferrer">官方 SRD</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a><small class="dnd-attribution">${e(s.attribution)}</small>${s.adventure.source ? `<p><a href="${s.adventure.source.publisherUrl}" target="_blank" rel="noopener noreferrer">${e(s.adventure.source.title)}</a> · ${e(s.adventure.source.copyright)} · <a href="${s.adventure.source.licenseUrl}" target="_blank" rel="noopener noreferrer">${e(s.adventure.source.license)}</a></p><p>${e(s.adventure.source.changes)} 中文改编 © 2026 Happy Online contributors，同许可分享；未使用原书插图。</p>` : ''}</details></div></details>`;
  }
