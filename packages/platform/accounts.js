import {randomBytes,randomUUID,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {ensure} from './errors.js';
import {boundedText} from './validation.js';
import {ensureProfile,ownProfile} from './profiles.js';
import {systemSettings} from './system.js';
const derive=promisify(scrypt);
const handleKey=value=>{ensure(typeof value==='string'&&/^[a-zA-Z0-9_]{3,24}$/.test(value),'账号需为 3–24 位字母、数字或下划线');return value.toLowerCase();};
const password=value=>{ensure(typeof value==='string'&&value.length>=10&&value.length<=128,'密码需为 10–128 个字符');return value;};
export class AccountService{
  constructor(store,sessions){this.store=store;this.sessions=sessions;}
  async register(input,guest){
    const key=handleKey(input.handle),name=boundedText(input.name??guest?.name??input.handle,24),salt=randomBytes(16).toString('hex');
    const digest=(await derive(password(input.password),salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024})).toString('hex');
    const user={id:guest?.id??randomUUID(),name,createdAt:Date.now()};
    this.store.transaction(data=>{
      ensure(systemSettings(data).registrationEnabled,'新账号注册暂时关闭',403);
      ensure(!Object.values(data.accounts).some(a=>a.key===key),'此账号已被使用',409);
      ensure(!data.accounts[user.id],'当前身份已经绑定账号',409);
      const p=ensureProfile(data,user);p.name=name;p.revision++;
      data.accounts[user.id]={id:user.id,handle:input.handle,key,salt,digest,createdAt:Date.now()};
    });
    return this.sessions.issue(user);
  }
  async login(input){
    const key=handleKey(input.handle);password(input.password);
    const account=Object.values(this.store.data.accounts).find(a=>a.key===key);
    const digest=await derive(input.password,account?.salt??'00000000000000000000000000000000',64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
    ensure(account&&timingSafeEqual(digest,Buffer.from(account.digest,'hex')),'账号或密码错误',401);
    return this.sessions.issue(ownProfile(this.store.data,account.id));
  }
  profile(user){return ownProfile(this.store.data,user.id);}
  rename(user,input){
    const name=boundedText(input.name,24);
    this.store.transaction(data=>{const p=data.profiles[user.id];ensure(p.revision===input.revision,'资料已更新，请重试',409);p.name=name;p.revision++;
    });
    return this.profile(user);
  }
}
