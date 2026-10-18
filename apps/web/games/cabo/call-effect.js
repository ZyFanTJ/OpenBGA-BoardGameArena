import { escapeHtml as e } from '../../ui.js';

/** Code-native artwork keeps the flight and its small badge crisp at every size. */
export function unicornArt() {
  return `<svg viewBox="0 0 320 230" fill="none" aria-hidden="true">
    <path d="M83 127C36 92 64 62 19 78C45 39 89 68 105 104" fill="#55bdb5" stroke="#c7ebe0" stroke-width="3"/>
    <path d="M118 148L83 184L40 181L36 192L91 199L143 159M169 153L190 190L233 194L238 183L205 177L199 137" fill="#d5e9dc" stroke="#264f58" stroke-width="4" stroke-linejoin="round"/>
    <path d="M99 107C119 95 150 107 170 102C183 81 183 56 215 45L252 50L273 75Q279 87 264 93L239 91L218 120C213 146 188 162 158 156L130 153L107 174L66 174L64 163L94 155L104 133C86 130 86 115 99 107Z" fill="#fff5d9" stroke="#264f58" stroke-width="4" stroke-linejoin="round"/>
    <path d="M176 111C178 79 179 53 206 43L221 46C196 63 212 77 194 85C213 97 203 108 189 120Z" fill="#60bdb2"/>
    <path d="M202 53L204 30L225 48M239 54L260 15L252 65" fill="#f6d884" stroke="#264f58" stroke-width="3" stroke-linejoin="round"/>
    <path d="M219 126L240 127L254 108L265 113L249 140L220 145" fill="#fff5d9" stroke="#264f58" stroke-width="4" stroke-linejoin="round"/>
    <path d="M116 119Q149 135 176 122M207 65Q196 74 199 80" stroke="#e3c98d" stroke-width="3" stroke-linecap="round"/>
    <path d="M238 71L245 73" stroke="#163f49" stroke-width="4" stroke-linecap="round"/>
    <circle cx="265" cy="83" r="2" fill="#264f58"/>
    <path d="M40 181L36 192L49 194L51 182M66 163L64 174H77L77 163M233 183L230 194L241 194L244 185M254 108L249 117L260 123L265 113" fill="#e7c877"/>
    <path d="M133 52L137 65L150 69L137 73L133 86L129 73L116 69L129 65ZM288 123L291 132L301 135L291 138L288 148L285 138L275 135L285 132Z" fill="#f8dc8c"/>
  </svg>`;
}

// Count unfinished turns using public seating order, including the current player's entire action.
export function finalTurnsRemaining(s) {
  if (!s.caller || ['setup', 'roundEnd', 'finished'].includes(s.phase)) return 0;
  const caller = s.players.findIndex(p => p.id === s.caller), turn = s.players.findIndex(p => p.id === s.turnId);
  return caller < 0 || turn < 0 ? 0 : (caller - turn + s.players.length) % s.players.length;
}

export function finalRoundBanner(s, name) {
  const remaining = finalTurnsRemaining(s);
  return remaining ? `<div class="cabo-final-banner" role="status" aria-live="polite"><span class="cabo-final-icon">${unicornArt()}</span><div><strong>最后一轮 <small>· 还剩 ${remaining} 人行动</small></strong><span>${e(name(s.caller))} 呼叫了 CABO</span></div></div>` : '';
}

/** Use the existing scene lifecycle so navigation, resize and disposal cancel every effect. */
export async function playCaboCall(scene, actorId, actorName, reduced = false) {
  if (scene.cancelled) return;
  const stage = scene.container.querySelector('.cabo-stage').getBoundingClientRect();
  const anchor = scene.after.get(`seat:${actorId}`);
  const overlay = document.createElement('div');
  overlay.className = 'cabo-call-effect';
  Object.assign(overlay.style, { left: `${stage.x}px`, top: `${stage.y}px`, width: `${stage.width}px`, height: `${stage.height}px` });
  overlay.innerHTML = `<div class="cabo-call-shade"></div><div class="cabo-call-wave"></div><div class="cabo-call-horse">${unicornArt()}</div><div class="cabo-call-caption"><strong>CABO!</strong><span>${e(actorName)} 呼叫了 CABO</span><b>最后一轮</b></div>`;
  scene.layer.append(overlay);
  const horse = overlay.querySelector('.cabo-call-horse'), caption = overlay.querySelector('.cabo-call-caption');
  const x = (anchor ? anchor.x + anchor.width / 2 : stage.x + stage.width / 2) - stage.x - stage.width / 2;
  const y = (anchor ? anchor.y + anchor.height / 2 : stage.y + stage.height * .4) - stage.y - stage.height * .4;
  const duration = reduced ? 1500 : 2500;
  const tasks = [scene.animate(overlay, [{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 1, offset: .84 }, { opacity: 0 }], duration, 0, 'linear'),
    scene.animate(caption, [{ opacity: 0 }, { opacity: 0, offset: .24 }, { opacity: 1, offset: .42 }, { opacity: 1 }], duration, 0, 'linear')];
  if (!reduced) {
    tasks.push(scene.pulse(`seat:${actorId}`));
    tasks.push(scene.animate(horse, [
      { transform: `translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(.18) rotate(-18deg)`, opacity: 0 },
      { offset: .12, opacity: 1 },
      { offset: .43, transform: 'translate(-50%,-65%) scale(1.07) rotate(-7deg)', opacity: 1 },
      { offset: .62, transform: 'translate(-50%,-50%) scale(1) rotate(0deg)' },
      { transform: 'translate(-50%,-54%) scale(1)', opacity: 1 },
    ], duration));
    tasks.push(scene.animate(overlay.querySelector('.cabo-call-wave'), [
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.25)' },
      { opacity: .8, offset: .2 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8)' },
    ], 1050, 1150));
    for (let i = 0; i < 14; i++) {
      const star = document.createElement('span'); star.className = 'cabo-call-star'; star.textContent = i % 3 ? '✦' : '☾';
      overlay.append(star);
      const angle = i * 2.4, radius = Math.min(stage.width * .37, 180);
      tasks.push(scene.animate(star, [
        { opacity: 0, transform: `translate(${x * .4}px,${y * .4}px) scale(.3)` },
        { opacity: .9, offset: .25 },
        { opacity: 0, transform: `translate(${Math.cos(angle) * radius}px,${Math.sin(angle) * radius * .7}px) scale(1.2)` },
      ], 1400, 350 + i * 35));
    }
    if (anchor) {
      const shout = document.createElement('div'); shout.className = 'cabo-call-shout'; shout.textContent = 'CABO!';
      Object.assign(shout.style, { left: `${anchor.x + anchor.width / 2}px`, top: `${Math.max(stage.y + 24, anchor.y - 16)}px` });
      scene.layer.append(shout);
      tasks.push(scene.animate(shout, [{ opacity: 0, transform: 'translate(-50%,0) scale(.7)' }, { opacity: 1, offset: .2, transform: 'translate(-50%,-8px) scale(1)' }, { opacity: 1, offset: .7 }, { opacity: 0, transform: 'translate(-50%,-18px) scale(1)' }], 850));
    }
  }
  await Promise.all(tasks);
}

export async function closeFinalRound(scene) {
  const felt = scene.container.querySelector('.felt-surface');
  if (felt) await scene.animate(felt, [{ boxShadow: 'inset 0 0 0 3px #f6d884, 0 0 32px #f6d88466' }, { boxShadow: 'inset 0 0 80px 20px #f6d88444, 0 0 0 #f6d88400' }, { boxShadow: 'inset 0 0 0 0 #f6d88400' }], 550);
}
