import {escapeHtml as e} from '../../ui.js';
import {icon} from './symbols.js';

const roman = age => ['I','II','III'][age - 1];
const sum = values => values.reduce((a,b) => a + b, 0);
const signed = value => value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0';
const tone = value => value > 0 ? 'sw-report-win' : value < 0 ? 'sw-report-loss' : 'sw-report-tie';
const control = (text, action, attrs = '') => `<button type="button" data-action="game:${action}" ${attrs}>${text}</button>`;
export const reportComplete = (game, result) => !game.expansions?.armada || Array.isArray(result.naval);
export function reportSteps(game, result) {
  return ['land', ...(Array.isArray(result.naval) ? ['naval'] : []), ...(reportComplete(game,result) ? ['summary'] : [])];
}

// This is a per-viewer reading preference, never a game command or persisted game state.
export function createReportTracker(storage) {
  let scope = '', seen = new Set(), previousCount = 0, remember = false;
  function save() {
    if (remember) try { (storage ?? globalThis.sessionStorage)?.setItem(scope,JSON.stringify([...seen])); } catch {}
  }
  return {
    pending(snapshot, viewerId) {
      const game = snapshot.game, results = game.ageResults ?? [];
      const next = `moon:7w:reports:${snapshot.id ?? 'preview'}:${snapshot.matchId ?? 'unversioned'}:${viewerId}`;
      if (next !== scope) {
        scope = next; seen = new Set(); remember = !!snapshot.matchId;
        if (remember) try {
          const saved = JSON.parse((storage ?? globalThis.sessionStorage)?.getItem(scope) ?? '[]');
          if (Array.isArray(saved)) seen = new Set(saved.filter(x => /^[123]:(land|complete)$/.test(x)));
        } catch {}
      } else if (results.length < previousCount) { seen.clear(); save(); }
      previousCount = results.length;
      const result = results.at(-1);
      if (!result) return null;
      const complete = reportComplete(game,result), key = `${result.age}:${complete ? 'complete' : 'land'}`;
      return seen.has(key) ? null : {type:'report', age:result.age, step:complete && seen.has(`${result.age}:land`) ? 'naval' : 'land'};
    },
    dismiss(game, age) {
      const result = game.ageResults.find(r => r.age === age);
      if (!result) return;
      seen.add(`${age}:land`);
      if (reportComplete(game,result)) seen.add(`${age}:complete`);
      save();
    },
  };
}

function tokens(values) {
  return values.length ? values.map(value => `<span class="sw-report-token ${tone(value)}" aria-label="${value > 0 ? '胜利' : '失败'}标记 ${value} 分">${icon(value > 0 ? 'crown' : 'shield')}<b>${signed(value)}</b></span>`).join('') : '<span class="sw-report-no-token">—</span>';
}

function landReport(game, result, viewerId, name) {
  const own = result.military.find(p => p.id === viewerId), points = sum(own?.tokens ?? []);
  const rivals = game.neighbors.map((id,i) => {
    const row = result.military.find(p => p.id === id);
    if (!row || !own) return '';
    const difference = own.shields - row.shields;
    return `<div class="sw-report-rival"><span>${i ? '右邻' : '左邻'} · ${e(name(id))}</span><strong>${icon('shield')}${row.shields}</strong><b class="${tone(difference)}">${difference > 0 ? '军力领先' : difference < 0 ? '军力落后' : '军力相同'}</b></div>`;
  }).join('');
  return `<div class="sw-report-feature"><div><span>你的军力</span><strong>${icon('shield')}${own?.shields ?? 0}</strong></div><div><span>本时代陆战</span><strong class="${tone(points)}">${signed(points)}</strong></div></div><div class="sw-report-rivals">${rivals}</div><div class="sw-report-scroll"><table class="sw-report-table"><thead><tr><th>玩家</th><th>军力</th><th>获得标记</th><th>得分</th></tr></thead><tbody>${result.military.map(p => `<tr class="${p.id === viewerId ? 'sw-report-self' : ''}"><th>${e(name(p.id))}${p.id === viewerId ? '<small>你</small>' : ''}</th><td>${p.shields}</td><td><div class="sw-report-tokens">${tokens(p.tokens)}</div></td><td class="${tone(sum(p.tokens))}">${signed(sum(p.tokens))}</td></tr>`).join('')}</tbody></table></div><details class="sw-report-rule"><summary>陆战结算规则</summary><p>与左右邻国分别比较军力：胜利 +${result.age * 2 - 1}，失败 −1，平局不发标记。表中为实际发放结果，包含登船和领袖修正。</p></details>`;
}

function navalReport(game, result, viewerId, name) {
  const rows = [...result.naval].sort((a,b) => b.strength - a.strength), own = rows.find(p => p.id === viewerId);
  const allEqual = rows.length > 1 && rows.every(p => p.strength === rows[0].strength);
  return `<div class="sw-report-feature"><div><span>${own ? '你的海军' : '本次海战'}</span><strong>${own ? `${icon('naval')}${own.strength}` : '未参加'}</strong></div><div><span>本时代海战</span><strong class="${tone(own?.token ?? 0)}">${signed(own?.token ?? 0)}</strong></div></div>${allEqual || rows.length < 2 ? `<p class="sw-report-neutral">${allEqual ? '海军实力全部相同，不发放标记' : '参战不足两人，不发放标记'}</p>` : ''}<div class="sw-report-scroll"><table class="sw-report-table"><thead><tr><th>玩家</th><th>海军</th><th>排名</th><th>得分</th></tr></thead><tbody>${rows.map(p => {
    const rank = rows.filter(r => r.strength > p.strength).length + 1, tied = rows.filter(r => r.strength === p.strength).length > 1;
    return `<tr class="${p.id === viewerId ? 'sw-report-self' : ''}"><th>${e(name(p.id))}${p.id === viewerId ? '<small>你</small>' : ''}</th><td>${p.strength}</td><td>${tied ? '并列 ' : ''}${rank}</td><td class="${tone(p.token)}">${signed(p.token)}</td></tr>`;
  }).join('')}${game.players.filter(p => !rows.some(r => r.id === p.id)).map(p => `<tr class="sw-report-withdrawn"><th>${e(name(p.id))}</th><td>—</td><td>退出海战</td><td>0</td></tr>`).join('')}</tbody></table></div><details class="sw-report-rule"><summary>海战结算规则</summary><p>先结算最弱者 −${result.age}，再结算第一 +${result.age * 2 + 1}、第二 +${result.age * 2 - 1}。最弱并列均失败；第一并列拿第二奖励，之后不发第二奖励；第二并列不获奖励。全体相同或参战不足两人不发标记。</p></details>`;
}

function summaryReport(game, result, viewerId, name) {
  const own = result.military.find(p => p.id === viewerId), land = sum(own?.tokens ?? []), naval = result.naval?.find(p => p.id === viewerId)?.token ?? 0;
  return `<div class="sw-report-summary"><span>你在时代 ${roman(result.age)} 的冲突得分</span><strong class="${tone(land + naval)}">${signed(land + naval)}</strong><div><span>${icon('shield')}陆战 <b>${signed(land)}</b></span>${Array.isArray(result.naval) ? `<span>${icon('naval')}海战 <b>${signed(naval)}</b></span>` : ''}</div></div><div class="sw-report-scroll"><table class="sw-report-table"><thead><tr><th>玩家</th><th>陆战</th>${result.naval ? '<th>海战</th>' : ''}<th>小计</th></tr></thead><tbody>${result.military.map(p => {
    const land = sum(p.tokens), naval = result.naval?.find(n => n.id === p.id)?.token ?? 0;
    return `<tr class="${p.id === viewerId ? 'sw-report-self' : ''}"><th>${e(name(p.id))}${p.id === viewerId ? '<small>你</small>' : ''}</th><td class="${tone(land)}">${signed(land)}</td>${result.naval ? `<td class="${tone(naval)}">${signed(naval)}</td>` : ''}<td class="${tone(land + naval)}">${signed(land + naval)}</td></tr>`;
  }).join('')}</tbody></table></div><p class="sw-report-footnote">冲突标记已入账；建筑、奇迹、科技等在终局统一计分。</p>`;
}

export function battleReport(snapshot, viewerId, overlay) {
  const game = snapshot.game, result = game.ageResults.find(r => r.age === overlay.age) ?? game.ageResults.at(-1);
  if (!result) return '';
  const name = id => snapshot.players.find(p => p.id === id)?.name ?? '玩家';
  const steps = reportSteps(game,result), step = steps.includes(overlay.step) ? overlay.step : 'land', index = steps.indexOf(step), next = steps[index + 1];
  const labels = {land:'陆战',naval:'海战',summary:'汇总'};
  const done = !reportComplete(game,result) ? '进行海战决策' : game.phase === 'finished' ? '查看总成绩' : game.age > result.age ? `继续时代 ${roman(game.age)}` : '返回牌桌';
  return `<dialog data-surface="report" class="sw-dialog sw-battle-report" aria-labelledby="sw-report-title"><div class="sw-report-heading"><div><span>时代 ${roman(result.age)}</span><h2 id="sw-report-title">${step === 'summary' ? '时代战报' : `${labels[step]}结算`}</h2></div>${control(icon('close'),'report-dismiss','class="sw-close" aria-label="关闭时代战报"')}</div><div class="sw-report-ages" role="group" aria-label="查看时代">${game.ageResults.map(r => control(`时代 ${roman(r.age)}`,'report-age',`data-age="${r.age}" aria-pressed="${r.age === result.age}"`)).join('')}</div><div class="sw-report-steps" role="group" aria-label="结算步骤">${steps.map((key,i) => control(`<i>${i < index ? icon('check') : i + 1}</i><span>${labels[key]}</span>`,'report-step',`data-step="${key}" aria-current="${key === step ? 'step' : 'false'}"`)).join('')}</div><section class="sw-report-content" data-report-step="${step}">${step === 'land' ? landReport(game,result,viewerId,name) : step === 'naval' ? navalReport(game,result,viewerId,name) : summaryReport(game,result,viewerId,name)}</section><footer class="sw-report-footer">${control('上次揭晓','history','class="sw-report-history"')}${control(next ? `下一步：${labels[next]}` : done,next ? 'report-step' : 'report-dismiss',next ? `data-step="${next}" class="sw-primary"` : 'class="sw-primary"')}</footer></dialog>`;
}

export function reportBanner(game, viewerId) {
  const result = game.ageResults.at(-1);
  if (!result) return '';
  const land = sum(result.military.find(p => p.id === viewerId)?.tokens ?? []), naval = result.naval?.find(p => p.id === viewerId)?.token;
  return `<div class="sw-report-banner"><span><b>时代 ${roman(result.age)} ${reportComplete(game,result) ? '已结算' : '陆战已结算'}</b><span>${icon('shield')}${signed(land)}${naval !== undefined ? `${icon('naval')}${signed(naval)}` : ''}</span></span>${control(`时代战报 ${icon('right')}`,'reports','aria-label="查看时代战报"')}</div>`;
}
