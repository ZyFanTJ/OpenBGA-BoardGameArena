import {randomBytes} from 'node:crypto';
import {systemSettings} from './system.js';
import {userAccess} from './access.js';

export const defaultInventory=['avatar-traveler','banner-night','title-wanderer'];
export function profileDetails(profile){return profile.details??{bio:'',favoriteGame:'',visibility:'friends',showcase:Object.values(profile.equipped??{}).filter(id=>profile.inventory.includes(id)).slice(0,4)};}
export function ensureProfile(data,user){
  if(data.profiles[user.id])return data.profiles[user.id];
  let friendCode;do{friendCode=randomBytes(4).toString('hex').toUpperCase();}while(Object.values(data.profiles).some(p=>p.friendCode===friendCode));
  const credits=systemSettings(data).welcomeCredits;
  const profile=data.profiles[user.id]={id:user.id,name:user.name,createdAt:user.createdAt??Date.now(),friendCode,credits,inventory:[...defaultInventory],equipped:{avatar:'avatar-traveler',banner:'banner-night',title:'title-wanderer'},revision:0};
  profile.details=profileDetails(profile);
  const id=`welcome:${user.id}`;data.transactions[id]={id,userId:user.id,kind:'welcome',amount:credits,balance:credits,at:Date.now()};
  return profile;
}
export function publicProfile(p){return {id:p.id,name:p.name,createdAt:p.createdAt,friendCode:p.friendCode,appearance:{...p.equipped}};}
export function ownProfile(data,id){const p=data.profiles[id],access=userAccess(data,id);return {...publicProfile(p),details:structuredClone(profileDetails(p)),credits:p.credits,inventory:[...p.inventory],revision:p.revision,registered:!!data.accounts[id],handle:data.accounts[id]?.handle??null,admin:!!data.accounts[id]&&access.role==='admin'&&!access.disabled};}
