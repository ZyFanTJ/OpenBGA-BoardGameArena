import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {ensureProfile,profileDetails} from './profiles.js';
import {defaultSettings} from './system.js';
import {defaultTextProvider} from './integrations.js';

export function migrateStorage(input){
  const data=structuredClone(input);
  if(data.version===1){
    Object.assign(data,{version:2,accounts:{},profiles:{},friendships:{},invitations:{},matches:{},transactions:{}});
    for(const user of Object.values(data.sessions))ensureProfile(data,user);
    for(const room of Object.values(data.rooms))if(room.game){room.matchId=`legacy-${room.id}-${room.revision}`;room.startedAt=room.createdAt;}
  }
  if(data.version===2){
    for(const profile of Object.values(data.profiles))profile.details=structuredClone(profileDetails(profile));
    data.version=3;
  }
  if(data.version===3){
    for(const room of Object.values(data.rooms))if(Array.isArray(room.players)){
      room.players.forEach((player,index)=>{player.seat=index;});
      room.revision++;
    }
    data.version=4;
  }
  if(data.version===4){
    data.forum={nextNumber:1,topics:{}};
    data.version=5;
  }
  if(data.version===5){
    data.system={revision:0,settings:{...defaultSettings}};
    data.administration={users:{},audit:[]};
    data.version=6;
  }
  if(data.version===6){
    for(const room of Object.values(data.rooms)){room.turnSeconds=0;room.turnClock=null;room.lastTimeout=null;room.revision++;}
    data.version=7;
  }
  if(data.version===7){data.integrations={revision:0,textProvider:defaultTextProvider()};data.version=8;}
  if(data.version===8){data.integrations.textProvider={...defaultTextProvider(),...data.integrations.textProvider};data.version=9;}
  if(data.version===9){data.friendConversations={};data.gameAppointments={};data.version=10;}
  if(data.version!==10)throw new Error('Unsupported storage version; migrate before starting.');
  return data;
}

/** Single-process transactional adapter. Replace this boundary with a database for scale. */
export class JsonStore {
  constructor(file) {
    this.file = file;
    const original=file&&existsSync(file)?readFileSync(file,'utf8'):null;
    const input=original?JSON.parse(original):{version:1,sessions:{},rooms:{}};
    this.data=migrateStorage(input);
    if(original&&input.version!==this.data.version){
      const backup=`${file}.v${input.version}.bak`;
      if(!existsSync(backup))writeFileSync(backup,original,{mode:0o600,flag:'wx'});
      this.transaction(()=>{});
    }
  }
  transaction(update) {
    const next = structuredClone(this.data);
    const result = update(next);
    if (this.file) {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(`${this.file}.tmp`, JSON.stringify(next), { mode: 0o600 });
      renameSync(`${this.file}.tmp`, this.file);
    }
    this.data = next;
    return result;
  }
}
