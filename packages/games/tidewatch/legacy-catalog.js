/** Public, data-only balance and geometry. Shared by rules and the game UI. */
export const WIDTH=800, HEIGHT=640, STEP=50, WAVES=18;
export const PATH=[[-30,130],[180,130],[180,300],[620,300],[620,500],[830,500]];
export const LENGTH=PATH.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-PATH[i][0],p[1]-PATH[i][1]),0);
export function pointAt(distance){let d=Math.max(0,Math.min(LENGTH,distance));for(let i=1;i<PATH.length;i++){const a=PATH[i-1],b=PATH[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d<=length)return {x:a[0]+(b[0]-a[0])*d/length,y:a[1]+(b[1]-a[1])*d/length,angle:Math.atan2(b[1]-a[1],b[0]-a[0])};d-=length;}return {x:830,y:500,angle:0};}
export const PADS=[[92,230],[280,195],[425,195],[565,190],[710,225],[92,390],[280,410],[435,410],[530,525],[715,405],[280,540],[425,540]].map(([x,y],id)=>({id,x,y}));
export const TOWERS={
 arrow:{name:'风羽弩塔',short:'弩塔',role:'单体 · 物理',cost:65,damage:18,cooldown:650,range:185,color:'#e6b76c',frame:0,damageType:'physical',description:'便宜可靠的主力，优先攻击即将漏出的怪物。',branches:[{id:'pierce',name:'破甲长弓',text:'伤害 +70%，无视一半护甲',damage:1.7,range:1.15},{id:'rapid',name:'疾风连弩',text:'攻击间隔 -45%，擅长快速收割',cooldown:.55}]},
 mortar:{name:'珊瑚迫击炮',short:'炮塔',role:'范围 · 物理',cost:100,damage:42,cooldown:1650,range:215,splash:90,color:'#ed9679',frame:1,damageType:'physical',description:'炮弹在一群敌人中爆炸，适合配合减速。',branches:[{id:'blast',name:'重型轰击',text:'爆炸范围 +45%，伤害 +35%',splash:1.45,damage:1.35},{id:'ember',name:'余烬炮台',text:'命中附加持续燃烧伤害',burn:true,damage:1.15}]},
 frost:{name:'潮晶霜塔',short:'霜塔',role:'减速 · 法术',cost:85,damage:9,cooldown:1100,range:175,splash:65,slow:.55,color:'#7cdfe3',frame:2,damageType:'magic',description:'范围减速，给整条防线更多输出时间。',branches:[{id:'winter',name:'极寒之心',text:'减速强化到 65%，范围扩大',slow:.35,splash:1.35},{id:'brittle',name:'碎晶棱镜',text:'被命中的敌人受到伤害 +25%',vulnerable:true,damage:2}]},
 storm:{name:'雷鸣线圈',short:'雷塔',role:'连锁 · 法术',cost:125,damage:24,cooldown:1100,range:185,chain:3,color:'#c1a4f7',frame:3,damageType:'magic',description:'闪电连跳多个目标，穿过密集的怪物队列。',branches:[{id:'chain',name:'风暴网络',text:'再连跳 3 个目标，覆盖怪群',chain:3},{id:'overload',name:'超载电核',text:'伤害 +110%，连跳减少 1 次',damage:2.1,chain:-1}]},
 beacon:{name:'晨光灯塔',short:'灯塔',role:'辅助 · 法术',cost:110,damage:12,cooldown:1200,range:200,aura:.14,color:'#ffe7a1',frame:4,damageType:'magic',description:'附近战斗塔伤害提高 14%，同类光环取最高值。',branches:[{id:'guidance',name:'领航之光',text:'光环升至 30%，范围 +20%',aura:.30,range:1.2},{id:'sun',name:'烈日透镜',text:'自身伤害提高 300%，射程 +30%',damage:4,range:1.3}]},
 market:{name:'丰潮渔市',short:'渔市',role:'经济 · 每波收益',cost:90,damage:0,cooldown:0,range:0,income:22,color:'#f5b791',frame:5,description:'每波结束获得 22 金币，每人最多 3 座。',branches:[{id:'trade',name:'远洋商会',text:'每波收入额外 +35',income:35},{id:'supply',name:'战备码头',text:'每波收入额外 +18，技能冷却 -20%',income:18,skill:true}]},
};
export const ENEMIES={
 slime:{name:'潮灵',hp:42,speed:49,armor:0,resist:0,bounty:6,frame:8,color:'#60d3bb',hint:'弩塔能高效处理'},
 crab:{name:'疾行蟹',hp:30,speed:85,armor:0,resist:0,bounty:6,frame:9,color:'#b799e6',hint:'减速后集中火力'},
 shell:{name:'铁壳寄居蟹',hp:100,speed:39,armor:.55,resist:0,bounty:10,frame:10,color:'#84b4ce',hint:'雷塔与霜塔绕过护甲'},
 jelly:{name:'幽光水母',hp:64,speed:51,armor:0,resist:.55,bounty:9,frame:11,color:'#d3a3ee',hint:'弩塔与炮塔克制魔抗'},
 swarm:{name:'刺鲀群',hp:24,speed:64,armor:0,resist:0,bounty:4,frame:12,color:'#f4b96b',hint:'迫击炮与连锁闪电清群'},
 shaman:{name:'海藻巫医',hp:105,speed:43,armor:.1,resist:.2,bounty:13,frame:13,color:'#a5c87a',hint:'附近怪物获得缓慢治疗，优先集火'},
 boss:{name:'珊瑚巨像',hp:1100,speed:29,armor:.25,resist:.25,bounty:80,frame:14,color:'#ec8e79',hint:'抗减速，搭配破甲与技能爆发'},
};
export const RELICS={
 haste:{name:'逐风帆',text:'所有战斗塔攻击间隔 -12%',color:'#b9e5d1'},
 reach:{name:'远望镜',text:'所有战斗塔射程 +15%',color:'#93cce8'},
 power:{name:'日珀碎片',text:'所有战斗塔伤害 +18%',color:'#f0c87b'},
 fortune:{name:'金潮罗盘',text:'每波补给额外 +25 金币',color:'#e6c06e'},
 rescue:{name:'同舟信标',text:'攻击队友漏怪时伤害 +35%',color:'#91d5c3'},
 glacier:{name:'深海寒玉',text:'攻击减速目标时伤害 +25%',color:'#a0e2e6'},
 architect:{name:'工匠徽记',text:'后续建造和升级费用 -12%',color:'#e6b59a'},
 spell:{name:'风暴瓶',text:'主动技能冷却 -25%，轰击伤害 +25%',color:'#bfacf0'},
 interest:{name:'丰收契约',text:'渔市收入 +35%，利息上限提高至 25',color:'#b8d28c'},
};
export const DIFFICULTIES={practice:{name:'轻潮',hp:.78,cap:65,waveMs:44000},normal:{name:'远航',hp:1,cap:48,waveMs:40000},storm:{name:'风暴',hp:1.3,cap:38,waveMs:36000}};
export const SKILLS={meteor:{name:'星火轰击',cooldown:55000,text:'轰击所选防区，对范围内敌人造成大量法术伤害',color:'#ee9d72'},freeze:{name:'潮汐静止',cooldown:42000,text:'所选防区全部敌人减速 75%，持续 5 秒',color:'#8edce7'}};
export function towerStats(tower,owner){const base=TOWERS[tower.kind],branch=base.branches.find(b=>b.id===tower.branch),level=tower.level??1;const relics=owner?.relics??[];return {damage:base.damage*[1,1,1.65,2.4,3.7][level]*(branch?.damage??1)*(relics.includes('power')?1.18:1),cooldown:base.cooldown*(branch?.cooldown??1)*(relics.includes('haste')?.88:1),range:base.range*(branch?.range??1)*(relics.includes('reach')?1.15:1),splash:(base.splash??0)*(branch?.splash??1),chain:(base.chain??0)+(branch?.chain??0),slow:branch?.slow??base.slow,aura:branch?.aura??base.aura??0,burn:!!branch?.burn,vulnerable:!!branch?.vulnerable,income:Math.round(((base.income??0)*[1,1,1.75,2.5,3.5][level]+(branch?.income??0))*(relics.includes('interest')?1.35:1)),skill:!!branch?.skill,damageType:base.damageType};}
export function costFor(kind,level=1,owner){return Math.ceil(TOWERS[kind].cost*[0,1,.85,1.7,2.7][level]*((owner?.relics??[]).includes('architect')?.88:1));}
export function harborCost(level){return [0,110,220,360][level]??Infinity;}
export function waveInfo(wave){const cycle=['slime','crab','swarm','shell','jelly','shaman'];const kind=cycle[(wave-1)%6];return {wave,kind,boss:wave%6===0,count:10+wave*2+(kind==='swarm'?10:0),name:wave%6===0?`${wave===18?'终潮':'巨像'}来袭`:ENEMIES[kind].name,hint:wave%6===0?'保留轰击，集中火力对付巨像':ENEMIES[kind].hint};}
