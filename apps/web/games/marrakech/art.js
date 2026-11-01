export const colorNames = ['珊瑚红', '琥珀金', '孔雀蓝', '紫罗兰'];
const colors = ['#bf5450', '#ca983d', '#2a9796', '#8166ac'];
export function rugArt(color, vertical = false, half = null) {
  const fill = colors[color] ?? colors[0];
  const symbols = ['◆', '✦', '❖', '✧'];
  const weave = Array.from({length:17},(_,i)=>`<path d="M9 ${10+i*5}h182" stroke="#ffedc4" opacity=".13" stroke-width=".65"/>`).join('');
  const stitching = Array.from({length:12},(_,i)=>`<path d="m${20+i*14} 12 3 3-3 3-3-3Zm0 70 3 3-3 3-3-3Z" fill="#fff0c4" opacity=".8"/>`).join('');
  return `<svg class="mk-rug-art" viewBox="${half === null ? '0 0 200 100' : vertical ? `0 ${half * 100} 100 100` : `${half * 100} 0 100 100`}" aria-hidden="true" preserveAspectRatio="none"><g ${vertical ? 'transform="translate(100 0) rotate(90)"' : ''}><rect x="2" y="3" width="196" height="94" rx="4" fill="${fill}"/><rect x="9" y="10" width="182" height="80" rx="2" fill="none" stroke="#f6df9c" stroke-width="3"/><rect x="15" y="16" width="170" height="68" fill="none" stroke="#f6df9c" stroke-width="1" stroke-dasharray="3 4"/><path d="M100 21 126 50 100 79 74 50Z M46 33 62 50 46 67 30 50Z M154 33 170 50 154 67 138 50Z" fill="#173d4c" stroke="#f6df9c" stroke-width="2"/><text x="100" y="59" text-anchor="middle" font-size="25" fill="#f9e6b4">${symbols[color]}</text><path d="M1 10h6M1 20h6M1 30h6M1 40h6M1 50h6M1 60h6M1 70h6M1 80h6M1 90h6M193 10h6M193 20h6M193 30h6M193 40h6M193 50h6M193 60h6M193 70h6M193 80h6M193 90h6" stroke="#fbe6b8" stroke-width="2"/>${weave}${stitching}</g></svg>`;
}
export const pawnArt = `<ellipse cy="25" rx="24" ry="11" fill="#342314" opacity=".3"/><path d="M-19 22Q-22 0-10-13H10Q22 0 19 22Q0 34-19 22" fill="#233e50" stroke="#f6d895" stroke-width="2"/><path d="M-6-9-10 24H10L6-9" fill="#e9cb85"/><circle cy="-18" r="12" fill="#f3d09c" stroke="#7a5335"/><path d="M-13-21Q-14-42 0-43Q14-42 13-21Z" fill="#ae4c43" stroke="#efca86" stroke-width="2"/><path d="M0-52-6-44H6Z" fill="#fff0b7"/>`;
export function borderArt() {
  // Same NW/SE loop orientation as the rules module. Paths are decorative, not hit targets.
  const paths = [];
  for (const start of [1, 3, 5]) {
    const a = 100 + start * 100, b = a + 100;
    paths.push(`M${a} 53C${a} 6 ${b} 6 ${b} 53`, `M53 ${a}C6 ${a} 6 ${b} 53 ${b}`);
  }
  for (const start of [0, 2, 4]) {
    const a = 100 + start * 100, b = a + 100;
    paths.push(`M${a} 747C${a} 794 ${b} 794 ${b} 747`, `M747 ${a}C794 ${a} 794 ${b} 747 ${b}`);
  }
  paths.push('M100 53C100 1 1 1 53 100', 'M700 747C700 799 799 799 747 700');
  return `<svg class="mk-border" viewBox="0 0 800 800" aria-hidden="true"><rect x="3" y="3" width="794" height="794" rx="30" fill="#153e48" stroke="#b99554" stroke-width="3"/><rect x="49" y="49" width="702" height="702" rx="4" fill="#c69960" stroke="#f3d698" stroke-width="2"/>${paths.map(d => `<path d="${d}" fill="none" stroke="#cfb276" stroke-width="5" stroke-linecap="round"/>`).join('')}<path d="M770 18l12 12-12 12-12-12ZM30 758l12 12-12 12-12-12Z" fill="#e4c789"/></svg>`;
}
export const catalogArt = `<div class="mk-cover-art"><span>${rugArt(2)}</span><span>${rugArt(0)}</span><span>${rugArt(1)}</span><svg viewBox="-40 -60 80 110">${pawnArt}</svg></div>`;
