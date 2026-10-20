const s=(resources,effect,text)=>({cost:{resources,coins:0},effect,text});
export const EXPANSION_WONDERS={
 roma:{name:'罗马',subtitle:'斗兽场',expansion:'leaders',resource:null,day:[s('woc',{points:4},'4 分'),s('sswt',{points:6},'6 分')],night:[s('wc',{coins:5,drawLeaders:4},'+5 钱币 · 抽取 4 位领袖'),s('swg',{points:3,recruitExtra:true},'3 分 · 额外招募 1 位领袖'),s('ssp',{points:3,recruitExtra:true},'3 分 · 额外招募 1 位领袖')]},
 'abu-simbel':{name:'阿布辛贝',subtitle:'拉美西斯神庙',expansion:'leaders',resource:'c',day:[s('co',{points:5},'5 分'),s('ssgt',{mummify:true},'埋葬已招募领袖，终局获得其费用的双倍分数')],night:[s('ccg',{mummify:true},'埋葬已招募领袖，终局获得其费用的双倍分数')]},
 siracusa:{name:'叙拉古',subtitle:'海港',expansion:'armada',resource:'g',unordered:true,day:[s('sso',{advance:1,naval:1},'海军 +1 · 免费推进任意舰队 1 格'),s('oot',{advance:1,points:3},'3 分 · 免费推进任意舰队 1 格'),s('ccp',{advance:1,shields:1},'军力 +1 · 免费推进任意舰队 1 格')],night:[s('ow',{coins:6,pirate:true},'+6 钱币 · 海盗劫掠'),s('ooc',{advance:2},'免费推进 2 支不同舰队各 1 格'),s('ccp',{shields:1,naval:1},'军力 +1 · 海军 +1')]},
};
