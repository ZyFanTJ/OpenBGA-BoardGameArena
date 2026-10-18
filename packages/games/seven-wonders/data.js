// Second edition (2020), base game. Printed costs and player-count marks;
// see docs/seven-wonders-rules.md for sources and timing decisions.
export const RESOURCES = { w:'木', s:'石', c:'砖', o:'矿', g:'玻璃', p:'纸', t:'布' };
export const COLORS = { brown:'原料', grey:'制品', blue:'市政', yellow:'商业', red:'军事', green:'科技', purple:'行会' };
const rows = [];
const add = (age, color, key, name, copies, cost, effect, text, from = []) => rows.push({key:`${age}-${key}`,kind:key,name,age,color,copies,cost:{resources:cost.replace(/1/g,''),coins:cost.includes('1')?1:0},effect,text,from});
const prod = (...production) => ({production});
for (const [key,name,r,copies] of [['lumber','伐木场','w',[3,4]],['stone','采石场','s',[3,5]],['clay','黏土池','c',[3,5]],['ore','矿脉','o',[3,4]]]) add(1,'brown',key,name,copies,'',prod(r),`每回合产 1${RESOURCES[r]}`);
for (const [key,name,r,n] of [['tree','林场','wc',6],['excavation','挖掘场','sc',4],['claypit','黏土坑','co',3],['timber','木石场','sw',3],['forest','森林矿洞','wo',5],['mine','矿场','os',6]]) add(1,'brown',key,name,[n],'1',prod(r),`每回合任选 1${[...r].map(x=>RESOURCES[x]).join(' / ')}`);
for (const age of [1,2]) for (const [key,name,r] of [['glass','玻璃坊','g'],['press','印刷坊','p'],['loom','织布坊','t']]) add(age,'grey',key,name,[3,age===1?6:5],'',prod(r),`每回合产 1${RESOURCES[r]}`);
for (const [key,name,copies,cost] of [['well','水井',[4,7],''],['baths','浴场',[3,7],'s'],['altar','祭坛',[3,5],''],['theater','剧场',[3,6],'']]) add(1,'blue',key,name,copies,cost,{points:3},'3 分');
add(1,'yellow','tavern','酒馆',[4,5,7],'',{coins:5},'立即获得 5 钱币');
add(1,'yellow','east','东贸易站',[3,7],'',{discount:'right'},'向右邻购买木石砖矿，每份 1 钱币');
add(1,'yellow','west','西贸易站',[3,7],'',{discount:'left'},'向左邻购买木石砖矿，每份 1 钱币');
add(1,'yellow','market','市场',[3,6],'',{discount:'goods'},'向两邻购买玻璃、纸、布，每份 1 钱币');
for (const [key,name,copies,cost] of [['stockade','栅栏',[3,7],'w'],['barracks','兵营',[3,5],'o'],['tower','守望塔',[3,4],'c']]) add(1,'red',key,name,copies,cost,{shields:1},'军力 +1');
for (const [key,name,copies,cost,science] of [['apothecary','药房',[3,5],'t',0],['workshop','工坊',[3,7],'g',1],['scriptorium','抄写室',[3,4],'p',2]]) add(1,'green',key,name,copies,cost,{science},['圆规','齿轮','石板'][science]);
for (const [key,name,r] of [['sawmill','锯木厂','w'],['quarry','采石厂','s'],['brickyard','砖窑','c'],['foundry','铸造厂','o']]) add(2,'brown',key,name,[3,4],'1',prod(r,r),`每回合产 2${RESOURCES[r]}`);
for (const [key,name,copies,cost,points,from] of [['statue','雕像',[3,7],'woo',4,['well']],['aqueduct','引水渠',[3,7],'sss',5,['baths']],['temple','神庙',[3,6],'wcg',4,[]],['courthouse','法院',[3,5],'cct',4,['scriptorium']]]) add(2,'blue',key,name,copies,cost,{points},`${points} 分`,from);
add(2,'yellow','caravansery','商队驿站',[3,5,6],'ww',prod('wsoc'),'每回合任选 1 木 / 石 / 矿 / 砖',['market']);
add(2,'yellow','forum','商会广场',[3,6,7],'cc',prod('gpt'),'每回合任选 1 玻璃 / 纸 / 布',['east','west']);
add(2,'yellow','vineyard','葡萄园',[3,6],'',{income:{color:'brown',scope:'all',coins:1}},'你与两邻每张原料牌，立即获得 1 钱币');
add(2,'yellow','bazar','集市',[4,7],'',{income:{color:'grey',scope:'all',coins:2}},'你与两邻每张制品牌，立即获得 2 钱币');
for (const [key,name,copies,cost,from] of [['stables','马厩',[3,5],'ocw',['apothecary']],['archery','射箭场',[3,6],'wwo',['workshop']],['walls','城墙',[3,7],'sss',[]],['training','训练场',[4,6,7],'woo',[]]]) add(2,'red',key,name,copies,cost,{shields:2},'军力 +2',from);
for (const [key,name,copies,cost,science,from] of [['dispensary','医务所',[3,4],'oog',0,['apothecary']],['laboratory','实验室',[3,5],'ccp',1,['workshop']],['library','图书馆',[3,6],'sst',2,['scriptorium']],['school','学校',[3,7],'wp',2,[]]]) add(2,'green',key,name,copies,cost,{science},['圆规','齿轮','石板'][science],from);
for (const [key,name,copies,cost,points,from] of [['pantheon','万神殿',[3,6],'ccogpt',7,['altar']],['gardens','花园',[3,4],'wcc',5,['theater']],['townhall','市政厅',[3,6],'goss',6,[]],['palace','宫殿',[3,7],'gptcwos',8,[]],['senate','议院',[3,5],'osww',6,['library']]]) add(3,'blue',key,name,copies,cost,{points},`${points} 分`,from);
for (const [key,name,copies,cost,color,coins,points,from] of [['lighthouse','灯塔',[3,6],'gs','yellow',1,1,['caravansery']],['haven','港口',[3,4],'tow','brown',1,1,['forum']],['commerce','商会',[4,6],'ccp','grey',2,2,[]],['ludus','竞技学校',[5,7],'so','red',3,1,[]],['arena','竞技场',[3,5],'oss','stages',3,1,['dispensary']]]) add(3,'yellow',key,name,copies,cost,{income:{color,scope:'own',coins},scoring:{color,scope:'own',points}},`每${color==='stages'?'个已建奇迹阶段':`张${COLORS[color]}牌`}立即 +${coins} 钱币，终局 +${points} 分`,from);
for (const [key,name,copies,cost,from] of [['castrum','军营要塞',[4,7],'ccwp',[]],['fortifications','防御工事',[3,7],'cooo',['walls']],['circus','马戏场',[4,6],'ssso',['training']],['arsenal','兵工厂',[3,5],'owwt',[]],['siege','攻城器械厂',[3,5],'wccc',['laboratory']]]) add(3,'red',key,name,copies,cost,{shields:3},'军力 +3',from);
for (const [key,name,copies,cost,science,from] of [['lodge','研究所',[3,6],'cctp',0,['dispensary']],['academy','学院',[3,7],'sssg',0,['school']],['observatory','天文台',[3,7],'oogt',1,['laboratory']],['study','书斋',[3,5],'wpt',1,['school']],['university','大学',[3,4],'wwpg',2,['library']]]) add(3,'green',key,name,copies,cost,{science},['圆规','齿轮','石板'][science],from);
for (const [key,name,cost,color,points] of [['workers','工人行会','oocsw','brown',1],['craftsmen','工匠行会','ooss','grey',2],['magistrates','执政官行会','wwwst','blue',1],['traders','商人行会','tpg','yellow',1],['spies','间谍行会','ccg','red',1],['philosophers','哲学家行会','ccctp','green',1]]) add(3,'purple',key,name,[],cost,{scoring:{color,scope:'neighbors',points}},`两邻每张${COLORS[color]}牌，终局 +${points} 分`);
add(3,'purple','builders','建筑师行会',[],'sssccg',{scoring:{color:'stages',scope:'all',points:1}},'你与两邻每个已建奇迹阶段，终局 +1 分');
add(3,'purple','decorators','装饰师行会',[],'oost',{complete:7},'完成全部奇迹阶段，终局 +7 分');
add(3,'purple','scientists','科学家行会',[],'wwoop',{wild:1},'终局任选 1 个科技符号');
add(3,'purple','shipowners','船主行会',[],'wwwpg',{scoring:{color:['brown','grey','purple'],scope:'own',points:1}},'自己每张原料、制品、行会牌，终局 +1 分');
export const CARDS = Object.fromEntries(rows.map(c=>[c.key,c]));
export const card = id => CARDS[id.split('@')[0]];
const stage = (resources,effect,text) => ({cost:{resources,coins:0},effect,text});
export const WONDERS = {
  alexandria:{name:'亚历山大',subtitle:'灯塔',resource:'g',day:[stage('ss',{points:3},'3 分'),stage('oo',prod('wsoc'),'任选 1 木 / 石 / 矿 / 砖'),stage('pt',{points:7},'7 分')],night:[stage('cc',prod('wsoc'),'任选 1 木 / 石 / 矿 / 砖'),stage('ooo',prod('gpt'),'任选 1 玻璃 / 纸 / 布'),stage('wwww',{points:7},'7 分')]},
  babylon:{name:'巴比伦',subtitle:'空中花园',resource:'w',day:[stage('cc',{points:3},'3 分'),stage('oot',{wild:1},'终局任选科技符号'),stage('wwww',{points:7},'7 分')],night:[stage('ss',{double:true},'每个时代多打最后一张牌'),stage('cccg',{wild:1},'终局任选科技符号')]},
  ephesus:{name:'以弗所',subtitle:'阿耳忒弥斯神庙',resource:'p',day:[stage('cc',{points:3},'3 分'),stage('ww',{coins:9},'立即 +9 钱币'),stage('oog',{points:7},'7 分')],night:[stage('ss',{points:2,coins:4},'2 分 · +4 钱币'),stage('ww',{points:3,coins:4},'3 分 · +4 钱币'),stage('oot',{points:5,coins:4},'5 分 · +4 钱币')]},
  giza:{name:'吉萨',subtitle:'金字塔',resource:'s',day:[stage('ww',{points:3},'3 分'),stage('cct',{points:5},'5 分'),stage('ssss',{points:7},'7 分')],night:[stage('ww',{points:3},'3 分'),stage('sss',{points:5},'5 分'),stage('ccc',{points:5},'5 分'),stage('pssss',{points:7},'7 分')]},
  halicarnassus:{name:'哈利卡纳苏斯',subtitle:'摩索拉斯陵墓',resource:'t',day:[stage('oo',{points:3},'3 分'),stage('gp',{revive:true},'从弃牌中免费建造一座建筑'),stage('sss',{points:7},'7 分')],night:[stage('cc',{points:2,revive:true},'2 分 · 免费回收建筑'),stage('gp',{points:1,revive:true},'1 分 · 免费回收建筑'),stage('www',{revive:true},'免费回收建筑')]},
  olympia:{name:'奥林匹亚',subtitle:'宙斯神像',resource:'c',day:[stage('ss',{points:3},'3 分'),stage('ww',{freeColor:true},'尚未拥有的颜色，首张建筑免费'),stage('ccc',{points:7},'7 分')],night:[stage('oo',{points:2,freeFirst:true},'2 分 · 每时代第 1 张建筑免费'),stage('ccc',{points:3,freeLast:true},'3 分 · 每时代第 6 张建筑免费'),stage('gpt',{points:5},'5 分')]},
  rhodes:{name:'罗得岛',subtitle:'太阳神巨像',resource:'o',day:[stage('ww',{points:3},'3 分'),stage('ccc',{shields:2},'军力 +2'),stage('oooo',{points:7},'7 分')],night:[stage('sss',{points:3,coins:3,shields:1},'3 分 · +3 钱币 · 军力 +1'),stage('oooo',{points:4,coins:4,shields:1},'4 分 · +4 钱币 · 军力 +1')]},
};
export const stages = player => player.side ? WONDERS[player.wonder][player.side] : [];
export const effects = player => [...player.cards.map(id=>card(id).effect),...stages(player).slice(0,player.stages).map(s=>s.effect)];
