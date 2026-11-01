// Shared public hand card for the lobby, preparation room and running game.
// Numbers and effects follow packages/games/tidewatch/catalog.js and index.js.
const art=(kind,extra='')=>`<span class="twh-unit twh-unit-${kind} ${extra}" aria-hidden="true"></span>`;
const fold=(title,body)=>`<details class="twh-fold"><summary>${title}</summary><div class="twh-fold-body">${body}</div></details>`;
const towers=[
 ['arrow','弩塔',65,'单体物理伤害，适合先建一座处理普通怪。'],
 ['mortar','炮塔',100,'炮弹炸一片。配上霜塔，怪物会在火力范围内多停一会儿。'],
 ['frost','霜塔',85,'对一片怪物造成法术伤害并减速，方便其他塔继续攻击。'],
 ['storm','雷塔',125,'闪电连跳多个目标。铁壳怪的护甲挡不住法术伤害。'],
 ['beacon','灯塔',110,'附近战斗塔伤害提高 14%。多座灯塔的同类加成只取最高值。'],
 ['market','渔市',90,'每波结束收入 22 金币，占一个塔位，不攻击。每人最多三座。'],
];
const enemies=[
 ['slime','潮灵','普通敌人，弩塔就能打。'],
 ['crab','疾行蟹','跑得快，用霜塔减速。'],
 ['shell','铁壳寄居蟹','物理护甲高，补雷塔或霜塔。'],
 ['jelly','幽光水母','法术抗性高，交给弩塔和炮塔。'],
 ['swarm','刺鲀群','数量多，炮塔和雷塔能一起打到多只。'],
 ['shaman','海藻巫医','会给附近的怪回血，把塔的攻击目标设为「治疗」。'],
 ['boss','珊瑚巨像','第 6、12、18 波出现，抗减速。升级主力塔，留好轰击。'],
];
export function guide(){
 return `<article class="twh-guide" aria-label="潮汐守望玩法手卡">
  <header class="twh-intro"><h2 class="twh-heading">守住 18 波</h2><p>1 至 4 人合作，各自建塔守岛。最后一波出完，清空全图怪物就赢。</p></header>
  <figure class="twh-crossing" aria-label="漏怪从你的岛进入队友的岛，保留剩余血量">
   <div class="twh-island"><span class="twh-island-name">你的岛</span><div class="twh-road"></div>${art('arrow','twh-island-tower')}<span class="twh-traveller twh-departing">${art('slime')}<i></i></span></div>
   <span class="twh-cross-arrow" aria-hidden="true">→</span>
   <div class="twh-island"><span class="twh-island-name">下一座岛</span><div class="twh-road"></div>${art('mortar','twh-island-tower')}<span class="twh-traveller">${art('slime')}<i></i></span></div>
   <figcaption>漏怪带着剩余血量进入下一座岛，绕一圈还会回来。全图只算一只。</figcaption>
  </figure>
  <p class="twh-loss">${art('slime')}<span>左上角显示全图怪物数。<strong>超过上限，全队失败。</strong></span></p>
  <section class="twh-start"><h3>先建一座塔</h3>
   <ol class="twh-steps"><li><span class="twh-pad" aria-hidden="true">＋</span><b>点地图空位</b></li><li>${art('arrow')}<b>选一种塔</b></li><li><span class="twh-build-sample" aria-hidden="true">建造 ◉ 65</span><b>点建造确认</b></li></ol>
   <p>开局有 220 金币。点空位会显示射程，确认前可以换塔或取消。</p>
  </section>
  ${fold('六种建筑',`<p class="twh-caption">图中是初始价格，局内以按钮上的费用为准。</p><div class="twh-towers">${towers.map(([id,name,price,text])=>`<article>${art(id)}<div><h4>${name}<span>◉ ${price}</span></h4><p>${text}</p></div></article>`).join('')}</div>`)}
  ${fold('升级与遗物',`<div class="twh-upgrade-strip"><span>${art('arrow')}<small>一阶</small></span><i>→</i><span>${art('arrow')}<small>二阶</small></span><i>→</i><span>${art('longbow')}<small>选专精</small></span></div><p>点已有的塔就能升级。二阶升三阶时选一个专精，选好后不能直接换。</p><div class="twh-branch-example"><span><b>破甲长弓</b><small>伤害 +70%，无视一半护甲</small></span><span><b>疾风连弩</b><small>攻击间隔缩短 45%</small></span></div><p>第 10 波起可以升四阶。第 5、10、15 波结束后，到「遗物」里三选一；暂时不选也会保留。</p><p>要换掉一座塔，展开「攻击 / 拆除」。拆除返还累计投入的 70%，不足一枚的部分舍去。</p>`)}
  ${fold('金币怎么花',`<div class="twh-economy"><div>${art('market')}<span><b>一阶渔市</b><small>花 90，每波收入 22</small></span></div><div><span class="twh-harbor" aria-hidden="true">⚓</span><span><b>港口升二级</b><small>花 110，每波多收 14</small></span></div></div><p>击杀会给赏金，每波结束还有补给。渔市占塔位，港口不占；两者都能升级增加收入。</p><p>存款每波获得 5% 利息，基础上限 15 金币。别一次把钱全投进经济，先让防线打得过眼前这波。</p><p>帮队友击杀漏怪，约七成赏金归击杀者，三成归怪物出生的岛。</p>`)}
  ${fold('技能怎么救场',`<div class="twh-skills"><article><div class="twh-skill-scene twh-meteor" aria-hidden="true">${art('crab')}${art('slime')}${art('crab')}<span>✦</span><i></i></div><h4>轰击 <small>基础冷却 55 秒</small></h4><p>点「轰击」，再点地图选落点，炸掉附近一片怪。</p></article><article><div class="twh-skill-scene twh-freeze" aria-hidden="true">${art('crab')}${art('slime')}${art('crab')}<span>❄</span></div><h4>减速 <small>基础冷却 42 秒</small></h4><p>点「减速」，当前这座岛的怪物减速 5 秒，巨像受到的减速较少。</p></article></div><p>这两个技能都不花金币。要帮队友，先点顶部防区切到他的岛，再施放技能。</p>`)}
  ${fold('认怪与选塔',`<div class="twh-enemies">${enemies.map(([id,name,text])=>`<article>${art(id)}<div><h4>${name}</h4><p>${text}</p></div></article>`).join('')}</div><p>点左上角的波次数字，也能查看当前怪物的提示。</p>`)}
  ${fold('波次、难度与其他规则',`<ul class="twh-rules"><li>开局有 40 秒部署。大家都点顶部的 ▶，就能提前迎战。波间整备 10 秒，期间仍可建造。</li><li>波次按时推进。上一波没清完，下一波也会来；整备时遗留的怪仍会移动，塔也继续攻击。</li><li>每人 12 个塔位，只能建造和升级自己的建筑。单人游玩时，漏怪回到自己的岛。</li><li>怪物绕完全图一圈会加速，最多达到原速的 1.6 倍。Boss 也只占一个怪物名额。</li></ul><div class="twh-cap-example"><small>两人「远航」示例</small><span>116 / 116 <b>还没失败</b></span><span>117 / 116 <b>全队失败</b></span></div><table class="twh-difficulties"><caption>共享上限随人数变化</caption><thead><tr><th>难度</th><th>怪物数量上限</th></tr></thead><tbody><tr><td>轻潮</td><td>65 × 人数 + 20</td></tr><tr><td>远航</td><td>48 × 人数 + 20</td></tr><tr><td>风暴</td><td>38 × 人数 + 20</td></tr></tbody></table><p>轻潮的怪物血量较低，风暴较高，第一次可以从轻潮开始。</p><p>最终波次原定结束后，再留两分钟清场。拖得更久，每 10 秒会来一批援军，每岛从 5 只开始翻倍，单批最多 320 只。仍然只按怪物数量是否超限判负。</p><p>断线后防线继续打，回来会接上最新战况。音效默认关闭，可在局内右上角的「⋯」中开启。</p><p>电脑按数字 1 到 6 选建筑，Esc 取消选择。手机点选即可，无须拖拽。</p>`)}
 </article>`;
}


