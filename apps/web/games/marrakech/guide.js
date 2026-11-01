import {sheet,section,flow,grid,badge,token,source,dieFace} from '../guide-ui.js';
import {rugArt} from './art.js';
const board=`<svg viewBox="0 0 260 130" role="img" aria-label="铺毯示例：新地毯两格共边，其中一格紧邻商人"><g fill="#284d52" stroke="#a4b9a1">${Array.from({length:15},(_,i)=>`<rect x="${10+i%5*38}" y="${8+Math.floor(i/5)*38}" width="36" height="36" rx="3"/>`).join('')}</g><rect x="48" y="46" width="74" height="36" rx="5" fill="#d6ac67"/><path d="M85 49v30" stroke="#71583c" stroke-dasharray="3 3"/><circle cx="141" cy="64" r="12" fill="#e9e4bd"/><path d="m135 65 6-9 6 9" fill="none" stroke="#254d51" stroke-width="3"/><text x="212" y="72" fill="#8ed2a4" font-size="27">✓</text><text x="53" y="112" fill="#fff3d1" font-size="12">新毯</text></svg>`;
export function visualGuide(){return sheet('Gigamic 英文规则 · 11-2024 · 2–4 人',
 flow([[token('↰ ↑ ↱'),'先选方向','直行或转 90°，不能掉头'],[dieFace(3),'掷骰移动','走完再计算落点费用'],[rugArt(0),'铺一块毯','两格相连，至少一格贴商人']])+
 section('专用骰子',`<div class="rg-dice" aria-label="骰面为 1、2、2、3、3、4">${[1,2,2,3,3,4].map(d=>dieFace(d)).join('')}</div>`)+
 section('合法铺放示意',`<div class="rg-example">${board}</div><p>金色是同一块新毯；不能压住商人，也不能一次完整盖住同一块旧毯。</p>`)+
 section('收费与结束',grid([badge(rugArt(1),'同色、共边才连通','落点所在连通区域有几格，就付几枚钱币。斜角不算。'),badge(token('＋'),'钱币 ＋ 可见格数','地毯用完后计分；同分比剩余钱币。')]))+
 `<div class="rg-note">双人各用两色，但收费仍按单色区域算。恰好付清可继续；不足付款才淘汰。</div>`+
 source('https://en.gigamic.com/index.php?controller=attachment&id_attachment=603','官方规则书 · 第 1–2 页'));
}
