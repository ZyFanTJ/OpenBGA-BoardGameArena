import {indexedRecords} from './record-index.js';
import {ensure} from './errors.js';
import {ownProfile} from './profiles.js';
import {systemSettings} from './system.js';

import {cosmetics} from './cosmetic-catalog.js';
export {cosmetics} from './cosmetic-catalog.js';

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
  this.store.transaction(data=>{const p=data.profiles[user.id];ensure(p.revision===input.revision,'装备已更新，请重试',409);ensure(p.inventory.includes(item.id),'尚未拥有此藏品',403);if(input.clear===true){ensure(item.type==='frame'||item.type==='accessory','此藏品不可卸下');if(p.equipped[item.slot??item.type]===item.id)delete p.equipped[item.slot??item.type];}else p.equipped[item.slot??item.type]=item.id;p.revision++;});
  return this.catalog(user);
 }
 ledger(user){return indexedRecords(this.store,'transactions','owner',t=>[t.userId],user.id).sort((a,b)=>b.at-a.at).slice(0,30);}
}
