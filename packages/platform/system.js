import {ensure} from './errors.js';

export const defaultSettings={
 siteName:'Moon Table',announcement:'',registrationEnabled:true,guestAccessEnabled:true,
 roomCreationEnabled:true,shopEnabled:true,forumPostingEnabled:true,
 welcomeCredits:300,practiceWinCredits:30,practiceLossCredits:20,multiplayerWinCredits:70,multiplayerLossCredits:40,
};
export const systemSettings=data=>({...defaultSettings,...data.system?.settings});
export function validateSettings(input){
 ensure(input&&typeof input==='object'&&!Array.isArray(input),'系统设置无效');
 ensure(Object.keys(input).length===Object.keys(defaultSettings).length&&Object.keys(input).every(k=>Object.hasOwn(defaultSettings,k)),'系统设置字段无效');
 const out={};
 for(const [key,fallback]of Object.entries(defaultSettings)){
  const value=input[key];
  if(typeof fallback==='boolean')ensure(typeof value==='boolean','开关设置必须为布尔值');
  else if(typeof fallback==='number')ensure(Number.isSafeInteger(value)&&value>=0&&value<=100000,'发放星辉需为 0–100000 的整数');
  else ensure(typeof value==='string'&&value.trim().length<=(key==='siteName'?32:300)&&(key!=='siteName'||value.trim().length>0),'站点名称或公告长度无效');
  out[key]=typeof value==='string'?value.trim():value;
 }
 return out;
}
export function publicSystem(data){const s=systemSettings(data);return {siteName:s.siteName,announcement:s.announcement,registrationEnabled:s.registrationEnabled,guestAccessEnabled:s.guestAccessEnabled,roomCreationEnabled:s.roomCreationEnabled,shopEnabled:s.shopEnabled,forumPostingEnabled:s.forumPostingEnabled,welcomeCredits:s.welcomeCredits};}
