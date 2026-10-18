import { escapeHtml as e, button as b } from '../../ui.js';
import { borderArt, colorNames, pawnArt, rugArt } from './art.js';

const directions = ['北 ↑', '东 →', '南 ↓', '西 ←'];
const coord = index => `${String.fromCharCode(65 + index % 7)}${Math.floor(index / 7) + 1}`;
function guide() {
  return `<div class="mk-guide-content"><span class="mk-kicker">MARRAKECH</span><h2>玩法手卡</h2><section><b>① 选方向 · 掷骰</b><p>直行或左右转 90°，不能掉头。<br>骰面 1 · 2 · 2 · 3 · 3 · 4</p></section><section><b>② 落地 · 付钱</b><p>踩中对手地毯，按同色连通格数付款。斜角不连通。付不起才淘汰。</p></section><section><b>③ 铺一块毯</b><p>选相邻两格，至少一格紧邻商人。不能盖住商人，也不能一次盖满同一块旧毯。</p></section><section><b>最后算分</b><p>剩余钱币 ＋ 可见地毯格数<br>同分时，钱币多者胜。</p></section><div class="mk-guide-colors">${[0,1,2,3].map(c => `<span class="mk-swatch mk-color-${c}">${['◆','✦','❖','✧'][c]}</span>`).join('')}</div><small>双人各用两色，收费仍按单色计算。</small></div>`;
}
export function createMarrakechRenderer(send, rerender) {
  let current, user, container, selected = [], direction = null, key = '', shown = -1, accepted = -1;
  let queue = [], running = false, generation = 0, animations = new Set();
  const name = id => current.players.find(p => p.id === id)?.name ?? '玩家';
  function render(snapshot, me) {
    current = snapshot; user = me;
    const s = snapshot.game, mine = s.turnId === me.id, enabled = mine && !snapshot.dissolution;
    const nextKey = `${s.sequence}:${s.phase}`;
    if (nextKey !== key) { key = nextKey; selected = []; direction = s.pawn.direction; }
    const pairs = enabled ? s.legal.placements : [];
    const available = new Set(pairs.filter(pair => !selected.length || pair.includes(selected[0])).flat());
    const owners = new Map(s.players.map(p => [p.id, p]));
    const cells = s.board.map((cell, i) => {
      let art = '';
      if (cell) {
        // Remembering a rug's original two cells keeps its pattern continuous after partial covering.
        art = rugArt(cell.color, cell.vertical, cell.half);
      }
      const pawn = i === s.pawn.y * 7 + s.pawn.x;
      return `<button class="mk-cell ${cell ? `mk-color-${cell.color}` : ''} ${cell && owners.get(cell.ownerId)?.eliminated ? 'mk-neutral' : ''} ${available.has(i) ? 'mk-legal' : ''} ${selected.includes(i) ? 'mk-selected' : ''}" data-action="game:cell" data-cell="${i}" aria-label="${coord(i)} ${pawn ? '商人所在格' : cell ? `${colorNames[cell.color]} · ${e(name(cell.ownerId))}` : '空地'}" aria-pressed="${selected.includes(i)}" ${!available.has(i) ? 'disabled' : ''}>${art}${!cell ? '<span class="mk-tile-star">✧</span>' : ''}${selected.includes(i) ? '<span class="mk-check">✓</span>' : ''}</button>`;
    }).join('');
    const localPlayer = s.players.find(p => p.id === me.id);
    let help = localPlayer?.eliminated ? '你已破产 · 继续观战' : `${name(s.turnId)} 的回合`, controls = '';
    if (s.phase === 'orient') {
      if (enabled) help = '选方向，再掷骰';
      controls = `<div class="mk-direction-picker" role="group" aria-label="前进方向">${directions.map((label,d) => b(['↑','→','↓','←'][d], 'game:direction', !enabled || !s.legal.directions.includes(d), `data-direction="${d}" aria-label="${label}" title="${label}" aria-pressed="${direction === d}"`)).join('')}<span class="mk-compass-center" aria-hidden="true">✦</span></div>${b('掷骰前进', 'game:roll', !enabled, 'class="gold-button mk-primary"')}`;
    } else if (enabled && s.phase === 'place') {
      help = selected.length === 0 ? '选一格，铺上你的地毯' : selected.length === 1 ? '再选相邻的一格' : '就铺这里？';
      controls = `${b('重选', 'game:clear', !selected.length, 'class="secondary"')}${b('铺下地毯', 'game:place', selected.length !== 2, 'class="gold-button mk-primary"')}`;
    }
    if (s.phase === 'finished') {
      help = `${s.winners.map(name).join('、')} 获胜`;
      controls = snapshot.hostId === me.id ? b('再来一局', 'rematch', false, 'class="gold-button"') : '<span>等待房主再开一局</span>';
    }
    const last = s.lastEvent, payment = last?.payment;
    const eventText = !last ? '市集开张' : last.type === 'place' ? `${name(last.actorId)} 铺下${colorNames[last.color]}地毯` : payment ? `${name(payment.fromId)} → ${name(payment.toId)} · ${payment.paid} 钱币${payment.eliminated ? ' · 破产' : ''}` : `${name(last.actorId)} 前进 ${last.die} 格 · 无需付款`;
    return `<div class="mk-layout mk-phase-${s.phase}"><section class="mk-table" aria-label="魔毯商人棋盘"><div class="mk-heading"><div><span class="mk-kicker">MARRAKECH</span><h1>魔毯商人</h1></div><span class="mk-round">第 ${s.turnNumber} 回合</span>${b('?', 'game:guide-open', false, 'class="mk-guide-open" aria-label="玩法手卡"')}</div><div class="mk-seats mk-seats-${s.players.length}">${s.players.map(p => {
      const score = s.scores.find(r => r.id === p.id);
      return `<article class="mk-seat ${p.id === s.turnId && s.phase !== 'finished' ? 'mk-active' : ''} ${p.eliminated ? 'mk-out' : ''}"><div class="mk-seat-name"><span class="mk-seat-colors" aria-label="${e(name(p.id))} 的地毯颜色">${p.colors.map(c => `<span class="mk-swatch mk-color-${c}">${['◆','✦','❖','✧'][c]}</span>`).join('')}</span><b>${e(name(p.id))}${p.id === me.id ? ' · 你' : ''}</b></div><div class="mk-seat-stats"><span title="钱币">◉ <strong>${p.coins}</strong></span><span title="可见地毯格数">▦ ${score.area}</span><span>${p.eliminated ? '已破产' : `余 ${p.remaining} 毯`}</span></div></article>`;
    }).join('')}</div><div class="mk-play-area"><div class="mk-board-wrap"><div class="mk-board">${borderArt()}<div class="mk-grid">${cells}</div><svg class="mk-pawn-layer" viewBox="0 0 800 800" aria-hidden="true"><g class="mk-pawn" transform="translate(${100 + s.pawn.x * 100} ${100 + s.pawn.y * 100}) rotate(${(mine && s.phase === 'orient' ? direction : s.pawn.direction) * 90})">${pawnArt}</g></svg></div></div><aside class="mk-operation-panel" aria-label="回合操作"><div class="mk-event" aria-live="polite"><span class="mk-die" aria-label="${last?.die ? `骰子 ${last.die}` : '骰子'}">${last?.die ?? '✦'}</span><span>${e(eventText)}</span>${s.phase !== 'finished' ? `<span class="mk-next-rug" title="本回合地毯 ${colorNames[s.nextColor]}">${rugArt(s.nextColor)}</span>` : ''}</div><div class="mk-controls"><p aria-live="polite">${e(help)}</p><div class="mk-actions">${controls}</div></div></aside></div>${s.phase === 'finished' ? `<div class="mk-results"><h2>市集收摊</h2><table><thead><tr><th>玩家</th><th>钱币</th><th>地毯格</th><th>总分</th></tr></thead><tbody>${[...s.scores].sort((a,b) => Number(a.eliminated)-Number(b.eliminated) || b.total-a.total || b.coins-a.coins).map(p=>`<tr><td>${s.winners.includes(p.id)?'♛ ':''}${e(name(p.id))}</td><td>${p.coins}</td><td>${p.area}</td><td>${p.eliminated?'已破产':p.total}</td></tr>`).join('')}</tbody></table></div>` : ''}</section><aside class="mk-guide">${guide()}</aside><dialog class="mk-guide-dialog"><button class="dialog-close" data-action="game:guide-close" aria-label="关闭玩法手卡">×</button>${guide()}</dialog></div>`;
  }
  async function animate(element, frames, duration) {
    if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = element.animate(frames, { duration, easing: 'ease-in-out', fill: 'forwards' });
    animations.add(animation); await animation.finished.catch(() => {}); animations.delete(animation);
    // Completed move transforms remain until the board is redrawn.
  }
  async function drain() {
    running = true;
    const token = generation;
    while (queue.length && token === generation) {
      const { snapshot, me } = queue.shift(), s = snapshot.game, event = s.lastEvent;
      if (current && shown >= 0 && s.sequence === shown + 1 && event) {
        container.querySelector('.mk-table')?.classList.add('mk-busy');
        if (event.type === 'move') {
          const pawn = container.querySelector('.mk-pawn'), dice = container.querySelector('.mk-die');
          const frames = [{ transform: `translate(${100+event.from.x*100}px,${100+event.from.y*100}px) rotate(${event.from.direction*90}deg)` }];
          let angle = event.from.direction * 90;
          const turnAngle = d => { let delta = (d * 90 - angle) % 360; if (delta > 180) delta -= 360; if (delta < -180) delta += 360; angle += delta; return angle; };
          frames.push({ transform: `translate(${100+event.from.x*100}px,${100+event.from.y*100}px) rotate(${turnAngle(event.direction)}deg)` });
          for (const point of event.path) {
            for (const via of point.via) frames.push({ transform: `translate(${100+via.x*100}px,${100+via.y*100}px) rotate(${angle}deg)` });
            frames.push({ transform: `translate(${100+point.x*100}px,${100+point.y*100}px) rotate(${turnAngle(point.direction)}deg)` });
          }
          await animate(dice, [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(180deg) scale(1.25)' }, { transform: 'rotate(360deg) scale(1)' }], 260);
          if (token !== generation) break;
          if (dice) dice.textContent = event.die;
          await animate(pawn, frames, 280 + event.path.length * 125);
          if (token !== generation) break;
          if (event.payment) await Promise.all(event.payment.cells.map(index => animate(container.querySelector(`[data-cell="${index}"]`), [{ filter: 'brightness(1)' }, { filter: 'brightness(1.9)' }, { filter: 'brightness(1)' }], 280)));
        }
      }
      if (token !== generation) break;
      container.innerHTML = render(snapshot, me); shown = s.sequence;
      if (event?.type === 'place' && s.sequence > 0) {
        container.querySelector('.mk-table')?.classList.add('mk-busy');
        await Promise.all(event.cells.map(index => animate(container.querySelector(`[data-cell="${index}"] .mk-rug-art`), [{ transform: 'translateY(-24px) scale(.88)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], 280)));
      }
      container.querySelector('.mk-table')?.classList.remove('mk-busy');
    }
    if (token === generation) running = false;
  }
  return {
    render,
    update(element, snapshot, me) {
      container = element;
      if (running) {
        if (snapshot.game.sequence > accepted) { accepted = snapshot.game.sequence; queue.push({ snapshot, me }); }
        return;
      }
      if (snapshot.game.sequence === shown) {
        const visual = value => JSON.stringify([value.game, value.players, value.hostId, value.dissolution]);
        if (current && snapshot.revision !== current.revision && visual(snapshot) === visual(current)) { current = snapshot; return; }
        element.innerHTML = render(snapshot, me); return;
      }
      accepted = snapshot.game.sequence; queue.push({ snapshot, me }); void drain();
    },
    async handle(action, element) {
      if (action === 'guide-open') { container.querySelector('.mk-guide-dialog').showModal(); return; }
      if (action === 'guide-close') { container.querySelector('.mk-guide-dialog').close(); return; }
      if (running || !current || current.game.turnId !== user.id || current.dissolution) return;
      if (action === 'direction') {
        const nextDirection = Number(element.dataset.direction);
        if (!current.game.legal.directions.includes(nextDirection)) return;
        direction = nextDirection; rerender();
      }
      else if (action === 'cell') {
        const index = Number(element.dataset.cell);
        if (selected.includes(index)) selected = selected.filter(n => n !== index);
        else if (selected.length === 2) selected = [index];
        else selected.push(index);
        rerender();
      } else if (action === 'clear') { selected = []; rerender(); }
      else if (action === 'roll') await send({ type: 'roll', direction });
      else if (action === 'place' && selected.length === 2) await send({ type: 'place', cells: [...selected] });
    },
    dispose() { generation++; animations.forEach(a => a.cancel()); animations.clear(); queue = []; running = false; current = null; shown = -1; accepted = -1; key = ''; },
  };
}
