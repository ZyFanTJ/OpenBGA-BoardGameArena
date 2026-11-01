/** Recruitment edition public catalog. No private random state or inventory. */
export * from './geometry.js';
import {PADS} from './geometry.js';
import {ENEMIES as OLD} from './legacy-catalog.js';
export const FACTIONS={tide:{name:'潮汐',color:'#78dce5',symbol:'≈',effect:'浸潮 · 连锁放电'},ember:{name:'炉火',color:'#ef9c72',symbol:'♨',effect:'积热 · 引信爆破'},gear:{name:'机巧',color:'#e5bf70',symbol:'⚙',effect:'校准 · 协同齐射'},star:{name:'星灯',color:'#c6aff8',symbol:'✧',effect:'星印 · 光束接力'}};
export const RARITIES=[{name:'普通',color:'#bec8c4',recycle:6},{name:'精良',color:'#7ebce5',recycle:10},{name:'史诗',color:'#bca0f3',recycle:16},{name:'传奇',color:'#efca7c',recycle:24}];
export const ODDS=[[100,0,0,0],[72,28,0,0],[45,43,12,0],[22,46,29,3],[10,36,49,5]];
export const RECRUIT_COST=40,LEVEL_COST=[0,80,120,180,240],LEVEL_WAVE=[1,1,3,6,10];
const rows=[
 ['潮弩塔','浸潮目标补射弱箭',{damage:22,cooldown:800,damageType:'physical'}],['雾潮桩','雾弹施加浸潮',{damage:7,cooldown:1200,splash:65,wet:true}],['跃电塔','闪电连跳三个目标',{damage:37,cooldown:1050,chain:3}],['潮镜台','把浸潮铺到一段路面',{damage:13,cooldown:950,splash:100,wet:true}],['风暴线圈','浸潮与连锁，命中触发放电',{damage:66,cooldown:950,chain:4,wet:true}],['天候仪','沿路推进的雷雨带',{damage:112,cooldown:1050,chain:5,wet:true,weather:true}],
 ['火矢台','火箭附带持续灼烧',{damage:21,cooldown:850,damageType:'physical',burn:true}],['风箱台','点燃敌人，帮助附近炉火塔',{damage:10,cooldown:1100,burn:true,bellows:true}],['熔弹炮','炮弹炸开一片并点燃',{damage:48,cooldown:1400,splash:90,burn:true,damageType:'physical'}],['引信塔','给灼烧目标装上引信',{damage:20,cooldown:1000,splash:65,burn:true,fuse:true}],['焚潮炉','积热后引爆引信',{damage:72,cooldown:1200,splash:90,burn:true,fuse:true}],['赤潮重炮','贯穿炮击与持续火带',{damage:136,cooldown:1450,splash:125,burn:true,fuse:true,firetrail:true,damageType:'physical'}],
 ['连弩台','快速物理点射',{damage:19,cooldown:650,damageType:'physical'}],['铆钉炮','削去一部分物理护甲',{damage:20,cooldown:1000,damageType:'physical',shred:true}],['齐射台','第三击展开扇形弹幕',{damage:37,cooldown:800,damageType:'physical',fan:true}],['校准台','组织附近机巧塔齐射',{damage:16,cooldown:1000,damageType:'physical',calibrate:true}],['组装车间','充能造出限时小炮台',{damage:61,cooldown:900,damageType:'physical',calibrate:true,assembly:true}],['百臂堡垒','本体与小炮台同步齐射',{damage:108,cooldown:780,damageType:'physical',calibrate:true,assembly:true,fortress:true}],
 ['星芒塔','命中留下星印',{damage:21,cooldown:900,mark:true}],['引路灯','照亮出口，扩大获取目标范围',{damage:9,cooldown:1100,mark:true,guide:true}],['折光镜','把伤害折射给另一敌人',{damage:34,cooldown:1050,chain:2,mark:true}],['共鸣钟','钟击施加星印，接力命中',{damage:15,cooldown:1100,splash:70,mark:true}],['观星台','点名高血量目标，落下星光',{damage:73,cooldown:1100,mark:true,astral:true}],['群星灯塔','连续光束沿星印接力',{damage:118,cooldown:1000,chain:4,mark:true,astral:true,constellation:true}],
];
const BASE_CARDS=Object.fromEntries(rows.map(([name,description,stats],frame)=>{const faction=Object.keys(FACTIONS)[Math.floor(frame/6)],slot=frame%6,rarity=[0,0,1,1,2,3][slot];return [`${faction}${slot}`,{name,short:name,description,faction,slot,rarity,frame,color:FACTIONS[faction].color,range:slot>=4?225:slot===3?210:185,cooldown:1000,damage:20,damageType:'magic',command:rarity===3?3:rarity===2?2:1,...stats}];}));

export const RECIPES=Object.keys(FACTIONS).flatMap(f=>[{id:`${f}2`,result:`${f}2`,needs:[{kind:`${f}0`,copies:2},{kind:`${f}1`,copies:1}],core:0},{id:`${f}3`,result:`${f}3`,needs:[{kind:`${f}1`,copies:2},{kind:`${f}0`,copies:1}],core:0},{id:`${f}4`,result:`${f}4`,needs:[{kind:`${f}2`,copies:2},{kind:`${f}3`,copies:1}],core:0},{id:`${f}5`,result:`${f}5`,needs:[{kind:`${f}4`,copies:1},{kind:`${f}3`,copies:2}],core:1}]);
const BASE_RELICS={
 conductor:{name:'导电刻痕',faction:'tide',stage:'start',text:'首次命中浸潮目标额外充能，同目标每三秒一次'},longtide:{name:'长潮瓶',faction:'tide',text:'雷雨带持续更久、移动更慢'},bipolar:{name:'双极针',faction:'tide',wave:14,text:'雷雨带结束时反向释放半伤电弧'},
 emberbox:{name:'余烬匣',faction:'ember',stage:'start',text:'引爆保留灼烧，下一轮继续积热'},twins:{name:'双生火种',faction:'ember',text:'隔一轮引爆多选一个目标，重叠伤害减半'},backfire:{name:'逆潮火线',faction:'ember',wave:14,text:'火带沿来路蔓延，提前点燃怪物'},
 gears:{name:'交错齿轮',faction:'gear',stage:'start',text:'齐射为不同目标分配弹道'},rails:{name:'长弩导轨',faction:'gear',text:'齐射穿透一个目标，普攻间隔增加10%'},returnfire:{name:'折返机匣',faction:'gear',wave:14,text:'齐射弹体折返一次，重复命中半伤'},
 starline:{name:'接星线',faction:'star',stage:'start',text:'星印攻击者记录跨岛保留'},echo:{name:'回响棱镜',faction:'star',text:'星印跳转保留一位攻击者记录'},doublestar:{name:'双星环',faction:'star',wave:14,text:'穿透光束一秒后沿原路再扫半伤'},
 ferry:{name:'渡海旗',text:'跨岛敌人首次受击破甲，共享六秒冷却'},crane:{name:'紧急吊装',text:'每波一次战斗中收起建筑，保留攻击等待'},horn:{name:'破浪号角',text:'轰击击退普通怪物，每目标五秒一次'},night:{name:'守夜灯芯',text:'每波首次清空跨岛怪，较长技能冷却减少五秒'},
};
const enemyHints={slime:'单体火力就能处理',crab:'用减速留住，再集中火力',shell:'法术绕过护甲，铆钉炮也能破甲',jelly:'机巧弹幕与物理炮击克制魔抗',swarm:'范围炮击与连锁闪电清群'};
export const ENEMIES={...Object.fromEntries(Object.entries(OLD).map(([id,x],frame)=>[id,{...x,speed:x.speed*1.65,frame,hint:enemyHints[id]??x.hint}])),gold:{name:'金壳巨蟹',hp:1100,speed:47.85,armor:.3,resist:0,frame:8,color:'#efc36b',hint:'物理减伤，持续召唤护卫'},crystal:{name:'晶壳搬运者',hp:1100,speed:47.85,armor:0,resist:0,frame:9,color:'#bca4ef',hint:'身边有护卫时减伤，先清护卫'},ancient:{name:'遗迹潮王',hp:1100,speed:47.85,armor:.25,resist:.25,frame:10,color:'#73d4d8',hint:'首次跨岛增兵，超时狂暴'},guard:{name:'悬赏护卫',hp:42,speed:80.85,armor:.05,resist:0,frame:11,color:'#8dcfc1',hint:'计入共享上限，没有掉落'}};
export const DIFFICULTIES={practice:{name:'轻潮',hp:.72,cap:65,waveMs:35000},normal:{name:'远航',hp:1,cap:48,waveMs:35000},storm:{name:'风暴',hp:1.32,cap:38,waveMs:35000}};
export const SKILLS={meteor:{name:'星火轰击',cooldown:55000,text:'轰击所选岛的目标位置',color:'#efad79'},freeze:{name:'潮汐静止',cooldown:42000,text:'所选防区减速五秒',color:'#92dce4'}};
export const BOUNTIES={gold:{name:'金壳巨蟹',wave:4,deposit:20,gold:80,team:20,hp:1.2,initial:2,batch:2,interval:10000,limit:55000,rewards:['gold'],text:'物理减伤 · 持续增兵'},crystal:{name:'晶壳搬运者',wave:7,deposit:40,team:40,hp:1.8,initial:4,batch:3,interval:8000,limit:70000,rewards:['card'],text:'护卫在身边时减伤30%'},ancient:{name:'遗迹潮王',wave:10,deposit:60,team:60,hp:2.6,initial:6,batch:4,interval:6000,limit:85000,rewards:['core','relic'],text:'首次跨岛增兵 · 超时狂暴'}};
export const commandCap=wave=>wave>=12?16:wave>=8?13:wave>=4?10:8;
export const incomeFor=wave=>60+2*wave+([6,12].includes(wave)?50:0);
export function traits(towers,id){const kinds=new Set(towers.filter(t=>t.owner===id&&!t.temporary).map(t=>t.kind));return Object.fromEntries(Object.keys(FACTIONS).map(f=>[f,[...kinds].filter(k=>CARDS[k].faction===f).reduce((n,k)=>n+(CARDS[k].rarity===3?2:1),0)]));}
export function waveInfo(wave){const cycle=['slime','crab','swarm','shell','jelly','shaman'],kind=cycle[(wave-1)%6];return {wave,kind,boss:wave%6===0,count:10+wave*2+(kind==='swarm'?10:0),name:wave%6===0?'巨像来袭':ENEMIES[kind].name,hint:wave%6===0?'保留技能，清护卫并集火巨像':ENEMIES[kind].hint};}

export const ROLES={damage:'主攻',support:'辅助',control:'控制',amplify:'增幅'};
const roles=['damage','control','damage','control','damage','damage','damage','support','damage','amplify','damage','damage','damage','control','damage','support','support','damage','damage','support','damage','amplify','damage','damage'];
const paths=[
 ['破潮重弩','focus','暴雨弩阵','rapid'],['缚潮寒桩','bind','回潮雾域','linger'],['雷霆接力','chain','定点雷枪','focus'],['寒潮镜阵','bind','广域潮镜','aura'],['电网枢纽','chain','疾电线圈','rapid'],['长潮天幕','range','雷暴天眼','focus'],
 ['蚀骨火矢','burn','连珠火矢','rapid'],['鼓风熔炉','aura','远烽风箱','range'],['集束熔弹','splash','重锤炮击','focus'],['破甲引信','expose','长燃导火索','burn'],['余烬熔心','burn','压缩焚炉','focus'],['焦土重炮','splash','猎王巨炮','focus'],
 ['蜂群连弩','rapid','穿甲弩炮','focus'],['裂甲铆钉','expose','震荡钉锤','bind'],['密集齐射','rapid','散射弹幕','splash'],['协同校准','aura','远程校准','range'],['流水装配','summon','战场中继','aura'],['百臂疾射','rapid','攻城堡垒','focus'],
 ['凝星长矛','focus','碎星接力','chain'],['辉光引航','aura','远望灯台','range'],['多重折光','chain','聚焦光镜','focus'],['易伤钟鸣','expose','回响增幅','aura'],['孤星点杀','focus','终幕星落','execute'],['星链洪流','chain','恒星聚束','focus']
];
export const BRANCHES={focus:{text:'重击伤害提升，攻击间隔变长',damage:1.4,cooldown:1.18},rapid:{text:'更快连击，单次伤害略降',damage:.9,cooldown:.68},bind:{text:'命中施加减速，适合在入口聚怪',slow:.62},linger:{text:'浸潮与灼烧持续更久，控制范围增大',duration:1.6,splash:100},chain:{text:'连锁多命中一个目标',chain:1},splash:{text:'炮击覆盖更多目标，单体伤害略降',splash:120,damage:.9},burn:{text:'强化持续灼烧，适合积热与清群',burn:true,burnPower:1.7},expose:{text:'命中破甲并使后续伤害提高',shred:true,expose:true},aura:{text:'附近建筑获得伤害增幅，三级扩大支援范围',aura:true},range:{text:'射程与支援距离增加',range:1.3},summon:{text:'小炮台更早完成组装',assembly:true,assemblyEvery:5},execute:{text:'对半血以下目标造成额外伤害',execute:true}};
export const CARDS=Object.fromEntries(Object.entries(BASE_CARDS).map(([id,b],i)=>[id,{...b,role:roles[i],range:b.range*1.25,branches:[{id:paths[i][1],name:paths[i][0]},{id:paths[i][3],name:paths[i][2]}]}]));
export const TOWERS=CARDS;
export const growthCost=c=>(c.baseLevel??1)===1?30+CARDS[c.kind].rarity*15:55+CARDS[c.kind].rarity*20;
export const RELIC_SLOTS={core:'核心',engine:'供能',link:'传导',finisher:'终结'};
const slotFor={conductor:'core',longtide:'engine',bipolar:'finisher',emberbox:'engine',twins:'finisher',backfire:'link',gears:'engine',rails:'link',returnfire:'finisher',starline:'core',echo:'link',doublestar:'finisher',ferry:'core',crane:'link',horn:'link',night:'engine'};
export const RELICS={...Object.fromEntries(Object.entries(BASE_RELICS).map(([id,r])=>[id,{...r,slots:[slotFor[id]]}])),
 steamheart:{name:'沸潮心核',slots:['core','link'],text:'把浸潮和炉火连成一条输出链',effects:{core:'主攻击命中浸潮目标时点燃，燃烧伤害为本次攻击的35%',link:'浸潮与灼烧同时存在时，主攻击额外积热，每目标每秒一次'}},
 flywheel:{name:'蓄电飞轮',slots:['engine','finisher'],text:'连击积蓄能量，再用重击释放',effects:{engine:'每六次主攻击释放一次120%法术脉冲',finisher:'每三个主攻击击杀，使下一次主攻击追加240%法术伤害'}},
 solitary:{name:'孤星透镜',slots:['core','link'],text:'给孤立主塔更高上限，也让摆位付出代价',effects:{core:'300范围内没有其他主塔时伤害提高80%，攻击间隔增加20%',link:'孤立主塔射程增加25%，附近辅助仍可从远处支援'}},
 tidalbond:{name:'渡海契约',slots:['core','finisher'],text:'围绕跨岛救援构筑防线',effects:{core:'对已经跨岛的敌人伤害提高60%，对未跨岛敌人降低10%',finisher:'每三个跨岛敌人被主攻击击杀，返还两种技能五秒冷却'}},
 treasurymark:{name:'港税金印',slots:['engine','link'],text:'修路、开地与防线运营共用一份预算',effects:{engine:'每个已开垦的收费地块每波额外给4金币，最多16',link:'矿场上的辅助建筑支援范围增加50%，矿场收入再加4'}},
 prismhub:{name:'棱镜枢纽',slots:['link','finisher'],text:'让潮汐与星印互相传导',effects:{link:'主攻击命中浸潮目标时留下星印，非星灯塔也可参与接力',finisher:'星印爆发在目标位置留下两秒导电区'}},
 overclock:{name:'越限机匣',slots:['core','engine'],text:'用经济或射程换取即时战力',effects:{core:'全体建筑攻击间隔缩短28%，射程降低20%',engine:'每波补给多20金币，但两种主动技能冷却增加15秒'}},
 funeralspark:{name:'余火灵匣',slots:['core','finisher'],text:'让燃烧击杀成为下一轮清场的起点',effects:{core:'主攻击击杀灼烧目标时，在附近最多四个敌人身上留下灼烧',finisher:'每次积热引爆留下火带；派生火带不继续触发击杀链'}}
};
export const activeRelics=p=>p?.relicSlots?Object.values(p.relicSlots).filter(Boolean):[...(p?.relics??[]),p?.bountyRelic].filter(Boolean);
export const hasRelic=(p,id)=>activeRelics(p).includes(id);
export const slotRelic=(p,slot,id)=>p?.relicSlots?.[slot]===id;
export function equipFirst(p,id){const slot=RELICS[id].slots.find(k=>!p.relicSlots[k]);if(slot)p.relicSlots[slot]=id;}
export function towerStats(t,owner,state){
 const b=CARDS[t.kind],level=t.baseLevel??1,branch=BRANCHES[t.branch]??{},st={...b,damage:b.damage*(t.star===2?2.2:1)*(1+.32*(level-1)),cooldown:b.cooldown,range:b.range,auraRadius:210,duration:1,burnPower:1,assemblyEvery:8};
 if(level>1){st.damage*=branch.damage??1;st.cooldown*=branch.cooldown??1;st.range*=branch.range??1;st.duration=branch.duration??1;st.burnPower=branch.burnPower??1;for(const k of ['slow','expose','execute','assemblyEvery'])if(branch[k])st[k]=branch[k];if(branch.burn)st.burn=true;if(branch.assembly)st.assembly=true;if(branch.splash)st.splash=Math.max(st.splash??0,branch.splash);if(branch.chain)st.chain=(st.chain??1)+branch.chain+(level===3?1:0);}
 st.aura=b.role==='support'||t.branch==='aura';if(st.aura)st.auraRadius=210*(level===3?1.25:1)*(t.branch==='range'?1.3:1);
 const pad=PADS[t.pad];if(pad?.terrain==='high')st.range*=1.2;if(pad?.terrain==='wind')st.cooldown*=.9;if(pad?.terrain==='relay')st.auraRadius*=1.35;
 if(hasRelic(owner,'rails')&&b.faction==='gear')st.cooldown*=1.1;
 if(slotRelic(owner,'core','overclock')){st.cooldown*=.72;st.range*=.8;}
 if(pad?.terrain==='mine'&&slotRelic(owner,'link','treasurymark'))st.auraRadius*=1.5;
 if(state&&pad&&!t.temporary){const allies=state.towers.filter(x=>x.owner===t.owner&&x.id!==t.id&&!x.temporary),isolated=!allies.some(x=>CARDS[x.kind].role==='damage'&&Math.hypot(PADS[x.pad].x-pad.x,PADS[x.pad].y-pad.y)<300);
  if(isolated&&slotRelic(owner,'core','solitary')){st.damage*=1.8;st.cooldown*=1.2;}if(isolated&&slotRelic(owner,'link','solitary'))st.range*=1.25;
  const buffs=allies.filter(x=>CARDS[x.kind].role==='support'||x.branch==='aura').filter(x=>{const q=PADS[x.pad];return Math.hypot(q.x-pad.x,q.y-pad.y)<210*(q.terrain==='relay'?1.35:1)*((x.baseLevel??1)===3?1.25:1)*(x.branch==='range'?1.3:1)*(q.terrain==='mine'&&slotRelic(owner,'link','treasurymark')?1.5:1);});if(buffs.length)st.damage*=1+Math.max(...buffs.map(x=>.12+.06*((x.baseLevel??1)-1)+(x.branch==='aura'?.08:0)));
 }return st;
}
