import { cardArt } from './cabo-cards.js';

function content(expert) {
  return `<div class="reference-heading"><span>随桌速查 · 2019 第二版</span><h2>CABO <small>玩法手卡</small></h2></div>
    <div class="reference-goal"><b>记住暗牌，让分数更低。</b><span>开局看 2 张自己的牌，记住后盖回。</span></div>
    <section class="reference-turn"><h3>轮到你时</h3><p>抽牌后选择换牌，或弃牌发动能力。<br>从弃牌堆拿牌，必须换入自己的牌列。</p></section>
    <div class="reference-powers">${[
      [7, '7–8', 'PEEK', '看自己的一张暗牌'],
      [9, '9–10', 'SPY', '看对手的一张暗牌'],
      [11, '11–12', 'SWAP', '与对手互换一张牌，不翻看'],
    ].map(([value, range, title, text]) => `<section class="reference-power"><span class="playing-card reference-mini" aria-hidden="true">${cardArt(value)}</span><div><h3><b>${range}</b> ${title}</h3><p>${text}</p></div></section>`).join('')}</div>
    <section class="reference-exchange"><h3>同点数，可以多换一</h3><p>选错则原牌保留，抽到的牌加入牌列。选 3 张以上，牌库有牌时再罚 1 张。</p><span class="reference-mode">${expert ? '专家模式 · 换入与失败牌均盖住' : '弃牌堆换入、失败保留的牌会公开'}</span></section>
    <section class="reference-call"><h3>觉得够低？呼叫 CABO</h3><p>本回合不抽牌，其他玩家各再行动一次。<br>你最低（含并列）记 0 分，否则加 10 分。</p></section>
    <div class="reference-special"><p><b>12 · 12 · 13 · 13</b><span>Kamikaze：自己 0 分，其余各 50 分</span></p><p><b>100 → 50</b><span>恰好 100 分可回退，每人限一次</span></p></div>
    <footer>有人超过 100 分时终局 · 累计最低分获胜</footer>`;
}

export function caboShell(expert) {
  return `<div class="cabo-layout"><div class="cabo-board"></div>
    <aside class="cabo-reference" aria-label="CABO 玩法手卡">${content(expert)}</aside>
    <button type="button" class="guide-toggle" data-action="game:guide-open" aria-haspopup="dialog" aria-controls="cabo-guide-dialog">玩法手卡</button>
    <dialog id="cabo-guide-dialog" class="guide-sheet" aria-label="CABO 玩法手卡"><button type="button" class="guide-close" data-action="game:guide-close" aria-label="关闭玩法手卡">×</button><div class="cabo-reference">${content(expert)}</div></dialog>
  </div>`;
}
