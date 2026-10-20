import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ensure } from './errors.js';
import { boundedText } from './validation.js';
import {ensureProfile,ownProfile} from './profiles.js';
import {requireActive} from './access.js';
import {systemSettings} from './system.js';

const hash = token => createHash('sha256').update(token).digest('hex');
export class SessionService {
  constructor(store) { this.store = store; }
  create(name) {
    const user = { id: randomUUID(), name: boundedText(name, 24), createdAt: Date.now() };
    return this.issue(user,{guest:true});
  }
  issue(user,{guest=false}={}){
    const token=randomBytes(32).toString('hex'),now=Date.now();
    this.store.transaction(data=>{
      if(guest)ensure(systemSettings(data).guestAccessEnabled,'游客入座暂时关闭，请登录账号',403);
      requireActive(data,user.id);
      ensureProfile(data,user);
      for(const [key,s] of Object.entries(data.sessions))if(now-s.createdAt>2592000000)delete data.sessions[key];
      data.sessions[hash(token)]={id:user.id,name:user.name,createdAt:now};
    });
    return {token,user:ownProfile(this.store.data,user.id)};
  }
  revoke(token){if(typeof token==='string')this.store.transaction(data=>{delete data.sessions[hash(token)];});
  }
  authenticate(token) {
    ensure(typeof token === 'string' && token.length === 64, '请先输入昵称', 401);
    const user = this.store.data.sessions[hash(token)];
    ensure(user&&Date.now()-user.createdAt<=2592000000, '会话已失效，请重新进入', 401);
    requireActive(this.store.data,user.id);
    return ownProfile(this.store.data,user.id);
  }
}
