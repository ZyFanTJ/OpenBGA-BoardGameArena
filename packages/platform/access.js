import {ensure} from './errors.js';

export const userAccess=(data,id)=>data.administration?.users[id]??{role:'player',disabled:false,revision:0};
export function requireActive(data,id){ensure(!userAccess(data,id).disabled,'此账号已停用，请联系管理员',403);}
export function requireAdmin(data,user){
 const access=userAccess(data,user?.id);
 ensure(data.accounts[user?.id]&&access.role==='admin'&&!access.disabled,'需要管理员权限',403);
}
