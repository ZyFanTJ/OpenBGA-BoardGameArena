// Second edition component facts. Resource letters follow data.js; artwork is not bundled.
const rows=[];
const add=(age,color,key,name,resources,effect,text,minPlayers=3)=>rows.push({key:`${age}-armada-${key}`,kind:`armada-${key}`,name,age,color,expansion:'armada',copies:[minPlayers],cost:{resources,coins:0},effect,text,from:[]});
add(1,'blue','construction','造船区','',{advance:1},'免费推进任意舰队 1 格');
add(1,'blue','dry-hold','干船坞','',{advance:1},'免费推进任意舰队 1 格');
add(1,'yellow','hideout','海盗藏身处','',{coins:3,pirate:true},'+3 钱币 · 海盗劫掠');
add(1,'red','coastal','海岸防线','g',{naval:1},'海军 +1');
add(1,'green','explorers','探险家议事厅','w',{majorityScience:1},'终局增加 1 个最多的科技符号');
add(1,'green','helmsman','舵手居所','s',{drawIsland:1},'立即获得 1 级岛屿');
add(1,'yellow','east-emporium','东海商站','t',{farTrade:{side:'right',limit:1}},'向右隔一位购买 1 份资源，支付 1 钱币',4);
add(1,'red','pontoon','浮桥','p',{shields:1,boarding:'right'},'军力 +1 · 本时代进攻右隔一位',4);
add(2,'blue','boathouse','船屋','cct',{advance:1,points:3},'3 分 · 免费推进任意舰队 1 格');
add(2,'blue','repair','修船厂','og',{advance:1,points:2},'2 分 · 免费推进任意舰队 1 格');
add(2,'yellow','den','海盗巢穴','',{coins:6,pirate:true},'+6 钱币 · 海盗劫掠');
add(2,'red','fortified-port','武装港口','wp',{naval:2},'海军 +2');
add(2,'green','navigation','航海事务所','sog',{majorityScience:1},'终局增加 1 个最多的科技符号');
add(2,'green','cartographers','制图师事务所','cw',{drawIsland:2},'立即获得 2 级岛屿');
add(2,'yellow','west-emporium','西海商站','op',{farTrade:{side:'left',limit:2}},'向左隔一位购买至多 2 份资源，每份 1 钱币',4);
add(2,'red','ballista','弩炮','wgt',{shields:2,boarding:'left'},'军力 +2 · 本时代进攻左隔一位',4);
add(3,'blue','headquarters','海军司令部','sscwp',{advance:1,points:5},'5 分 · 免费推进任意舰队 1 格');
add(3,'blue','harbor-master','港务长官邸','csot',{advance:1,points:4},'4 分 · 免费推进任意舰队 1 格');
add(3,'yellow','crew','海盗船员','cg',{points:4,pirate:true},'4 分 · 海盗劫掠');
add(3,'red','fortifications','海岸要塞','sswg',{naval:3},'海军 +3');
add(3,'green','captains','船长议会','wwsot',{majorityScience:1},'终局增加 1 个最多的科技符号');
add(3,'green','archives','航海档案馆','oocp',{drawIsland:3},'立即获得 3 级岛屿');
add(3,'yellow','customs','港口关税局','oosw',{commercialPoints:2},'终局得分为商业等级 ×2');
add(3,'red','pier','码头','cccpt',{shields:3,boarding:'right'},'军力 +3 · 本时代进攻右隔一位',4);
export const ARMADA_CARDS=Object.fromEntries(rows.map(c=>[c.key,c]));
const islands=[];
const island=(level,key,name,effect,text)=>islands.push({key:`island-${key}`,kind:`island-${key}`,name,age:level,level,color:'island',expansion:'armada',cost:{resources:'',coins:0},effect,text,from:[],copies:[]});
island(1,'virgin','原始岛',{production:['ws']},'每回合任选 1 木 / 石');
island(1,'overgrown','蔓生岛',{production:['oc']},'每回合任选 1 矿 / 砖');
island(1,'inhabited','居民岛',{points:3},'3 分');
island(1,'bronze','青铜岛',{shields:1},'军力 +1');
island(1,'whistling','鸣风岛',{naval:1},'海军 +1');
island(1,'topaz','黄玉岛',{advanceColor:'blue'},'免费推进蓝色舰队 1 格');
island(1,'amber','琥珀岛',{advanceColor:'yellow'},'免费推进黄色舰队 1 格');
island(1,'lost','失落岛',{advanceCoins:1},'此后每推进舰队 1 格，获得 1 钱币');
island(1,'foggy','雾岛',{taxShield:true},'免受其他玩家的税收与海盗钱币损失');
island(2,'abandoned','荒废绿洲',{production:['gpt']},'每回合任选 1 玻璃 / 纸 / 布');
island(2,'statues','雕像绿洲',{points:5},'5 分');
island(2,'iron','钢铁绿洲',{shields:2},'军力 +2');
island(2,'windy','风之绿洲',{naval:2},'海军 +2');
island(2,'forgotten','遗忘绿洲',{navalChoice:true},'每时代海战前，可选择退出海战');
island(2,'stormy','风暴绿洲',{advance:2},'免费推进 2 支不同舰队各 1 格');
island(2,'ancient','古代绿洲',{wonderAdvance:true},'此后建造奇迹时，免费推进任意舰队 1 格');
island(2,'wondrous','奇迹绿洲',{reduceNaval:1},'此后每次造船少支付任意 1 份资源');
island(2,'pirate','海盗绿洲',{points:3,pirate:true},'3 分 · 其他玩家损失等同自身商业等级的钱币');
island(3,'royal','皇家群岛',{points:7},'7 分');
island(3,'golden','黄金群岛',{wild:1},'终局任选 1 个科技符号');
island(3,'emerald','翡翠群岛',{majorityScience:1},'终局增加 1 个最多的科技符号');
island(3,'scarlet','绯红群岛',{shields:3},'军力 +3');
island(3,'breezy','微风群岛',{naval:3},'海军 +3');
island(3,'torrential','激流群岛',{advance:3},'免费推进 3 支不同舰队各 1 格');
island(3,'sheltered','避风群岛',{islandPoints:2},'每座岛屿（包括本岛）2 分');
island(3,'rainbow','彩虹群岛',{maxColorPoints:1},'最多的同色时代建筑，每张 1 分');
island(3,'lush','繁茂群岛',{commercialPoints:2},'终局得分为商业等级 ×2');
export const ISLANDS=Object.fromEntries(islands.map(c=>[c.key,c]));
export const FLEET_COLORS=['red','yellow','blue','green'];
const yard=(linked,red,yellow,blue,green)=>({linked,costs:Object.fromEntries([red,yellow,blue,green].map((costs,i)=>[FLEET_COLORS[i],costs.split(' ').map(x=>({resources:/^\d$/.test(x)?'':x,coins:/^\d$/.test(x)?Number(x):0}))]))});
export const SHIPYARDS=[
 yard('green','o g cs ct ow pt','s t ow sp cs gp','w p sw wg co gt','c 2 co 3 sw 4'),
 yard('blue','w t co cg sw gp','o g sw wp co pt','c p so ot cw gt','s 2 cw 3 so 4'),
 yard('red','s p sw wt co gt','o g co op sw gp','c t ow sg cs pt','o 2 cs 3 ow 4'),
 yard('green','w g so cg cw pt','o t cw sp so gt','s p co wt sw gp','c 2 sw 3 co 4'),
 yard('blue','s g co wt sw gp','c p sw og co gt','o t cw cp so pt','w 2 so 3 cw 4'),
 yard('yellow','o t cw cp so gp','w g so og cw pt','c p ow st cs gt','s 2 cs 3 ow 4'),
 yard('red','c p sw sg co gt','s t co wp sw gp','w g so ot cw pt','o 2 cw 3 so 4'),
];
export const COMMERCIAL=[0,1,1,2,2,3,4];
export const BLUE_POINTS=[0,1,2,4,6,8,10];
export const RED_STRENGTH=[0,1,2,3,4,5,8];
