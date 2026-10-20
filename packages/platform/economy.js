import {ensure} from './errors.js';
import {ownProfile} from './profiles.js';
import {systemSettings} from './system.js';

export const cosmetics=[
 {id:'avatar-traveler',name:'月下旅人',type:'avatar',rarity:'classic',price:0,art:'initial',description:'每段旅程，都从一次入座开始。'},
 ...[['wolf','霜月银狼',120],['owl','星夜雪鸮',120],['fox','赤焰灵狐',160],['dragon','苍穹古龙',240],['guardian','曙光守卫',180],['scholar','观星贤者',180]].map(([key,name,price],index)=>({id:`avatar-${key}`,name,type:'avatar',rarity:price>=200?'legendary':'rare',price,portrait:index,description:'用独特的头像，留下你的牌桌印记。'})),
 {id:'banner-night',name:'月夜启程',type:'banner',rarity:'classic',price:0,art:'night',description:'初始个人名片背景。'},
 ...[['observatory','群星议会','social',260],['laurels','荣耀回廊','archive',280],['treasury','月辉秘藏','shop',300]].map(([key,name,art,price])=>({id:`banner-${key}`,name,type:'banner',rarity:'epic',price,art,description:'全幅个人名片背景，装备后展示给好友。'})),
 {id:'title-wanderer',name:'初来乍到',type:'title',rarity:'classic',price:0,description:'新的同桌，新的故事。'},
 {id:'title-strategist',name:'运筹帷幄',type:'title',rarity:'rare',price:80,description:'把每一次选择，都变成自己的节奏。'},
 {id:'title-starlord',name:'群星执掌者',type:'title',rarity:'legendary',price:200,description:'以智慧点亮属于你的星图。'},
];
export function rewardMatch(data,userId,matchId,win,practice){
 const p=data.profiles[userId],id=`reward:${matchId}:${userId}`;if(!p)return 0;if(data.transactions[id])return data.transactions[id].amount;
 const settings=systemSettings(data),amount=practice?(win?settings.practiceWinCredits:settings.practiceLossCredits):(win?settings.multiplayerWinCredits:settings.multiplayerLossCredits);p.credits+=amount;p.revision++;
 data.transactions[id]={id,userId,kind:'reward',matchId,amount,balance:p.credits,at:Date.now()};
 return amount;
}
export class EconomyService{
 constructor(store){this.store=store;}
 catalog(user){return {items:cosmetics,profile:ownProfile(this.store.data,user.id)};}
 purchase(user,input){
  ensure(typeof input.requestId==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId),'兑换请求标识无效');
  const item=cosmetics.find(x=>x.id===input.itemId);ensure(item&&item.price>0,'商品不存在',404);
  this.store.transaction(data=>{
   ensure(systemSettings(data).shopEnabled,'商城兑换暂时关闭',403);
   const key=`purchase:${user.id}:${input.requestId}`,existing=data.transactions[key];
   if(existing){ensure(existing.itemId===item.id,'请勿复用兑换请求',409);return;}
   const p=data.profiles[user.id];ensure(p.revision===input.revision,'星辉或藏品已更新，请刷新重试',409);
   ensure(!p.inventory.includes(item.id),'已拥有此藏品',409);ensure(p.credits>=item.price,'星辉不足，完成对局即可积累');
   p.credits-=item.price;p.inventory.push(item.id);p.revision++;
   data.transactions[key]={id:key,userId:user.id,kind:'purchase',itemId:item.id,amount:-item.price,balance:p.credits,at:Date.now()};
  });return this.catalog(user);
 }
 equip(user,input){
  const item=cosmetics.find(x=>x.id===input.itemId);ensure(item,'藏品不存在',404);
  this.store.transaction(data=>{const p=data.profiles[user.id];ensure(p.revision===input.revision,'装备已更新，请重试',409);ensure(p.inventory.includes(item.id),'尚未拥有此藏品',403);p.equipped[item.type]=item.id;p.revision++;});
  return this.catalog(user);
 }
 ledger(user){return Object.values(this.store.data.transactions).filter(t=>t.userId===user.id).sort((a,b)=>b.at-a.at).slice(0,30);}
}
