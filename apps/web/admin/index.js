import {api} from '../api.js';
import {escapeHtml as e} from '../ui.js';
import {adminPage,adminLogin,userDetail,userEditor,sections,button} from './views.js';

const requestId=()=>globalThis.crypto.randomUUID?.()??[...crypto.getRandomValues(new Uint8Array(20))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function createAdmin({root,shell,getUser,setUser,notify,onSettingsChanged}){
 let active=false,section='overview',data=null,generation=0,working=false,selected=null,editor=null,operationId=null,returnFocus=null;
 const state={q:'',filter:'all',sort:'newest',page:1,auditQ:'',auditPage:1};
 function dispose(){active=false;generation++;data=null;selected=null;editor=null;operationId=null;}
 function show(){
  shell.show(adminPage(section,data,getUser(),state),getUser(),'admin');
  root.querySelector('#adm-dialog')?.addEventListener('cancel',event=>{event.preventDefault();if(editor)displayDetail();else close();});
 }
 async function load(){
  const run=++generation;
  root.querySelector('#adm-content')?.setAttribute('aria-busy','true');
  const query=section==='users'?new URLSearchParams({q:state.q,filter:state.filter,sort:state.sort,page:state.page}):section==='audit'?new URLSearchParams({q:state.auditQ,page:state.auditPage}):'';
  try{
   const result=await api(`/admin/${section}${query?'?'+query:''}`);
   if(!active||run!==generation)return;
   data=result;show();
  }catch(error){
   if(!active||run!==generation)return;
   if(error.status===401){setUser(null);shell.show(adminLogin(null),null,'admin');}
   else if(error.status===403)shell.show(adminLogin(getUser()),getUser(),'admin');
   else{notify(error.message);if(!data)shell.show(`<main class="adm-access"><h1>暂时无法载入</h1><p>${e(error.message)}</p>${button('重试','refresh','class="adm-primary"')}</main>`,getUser(),'admin');}
  }finally{if(active&&run===generation)root.querySelector('#adm-content')?.removeAttribute('aria-busy');}
 }
 async function open(next='overview'){
  active=true;section=Object.hasOwn(sections,next)?next:'overview';data=null;selected=null;editor=null;shell.closeMenu();history.replaceState(null,'',`#admin/${section}`);
  if(!getUser()){shell.show(adminLogin(null),null,'admin');return;}
  shell.show('<main class="adm-access"><span class="adm-loading-mark">◐</span><p>正在载入管理中心…</p></main>',getUser(),'admin');await load();
 }
 function close(){root.querySelector('#adm-dialog')?.close();selected=null;editor=null;operationId=null;returnFocus?.focus({preventScroll:true});}
 function displayDetail(){
  const dialog=root.querySelector('#adm-dialog');if(!dialog||!selected)return;
  editor=null;operationId=null;dialog.className='adm-dialog adm-user-dialog';dialog.innerHTML=userDetail(selected,selected.id===getUser()?.id);dialog.setAttribute('aria-label',`${selected.name} 的用户档案`);
  if(!dialog.open)dialog.showModal();
  dialog.querySelector('.adm-dialog-close')?.focus({preventScroll:true});
 }
 async function openUser(id){
  const run=++generation;returnFocus=document.activeElement;
  const detail=await api('/admin/users/'+encodeURIComponent(id));if(!active||run!==generation)return;
  selected=detail;displayDetail();
 }
 function edit(kind){
  if(!selected)return;editor=kind;operationId=requestId();const dialog=root.querySelector('#adm-dialog');dialog.className='adm-dialog adm-edit-dialog';dialog.innerHTML=userEditor(selected,kind);dialog.querySelector('input,textarea')?.focus({preventScroll:true});
 }
 async function handle(action,target){
  if(action==='home')return;
  if(action==='close'){close();return;}
  if(action==='back-detail'){displayDetail();return;}
  if(working)return;
  try{
   if(action==='section'){await open(target.dataset.section);return;}
   if(action==='refresh'||action==='reload-settings'){await load();return;}
   if(action==='page'){if(section==='users')state.page=Number(target.dataset.page);else state.auditPage=Number(target.dataset.page);await load();return;}
   if(action==='user'){await openUser(target.dataset.id);return;}
   if(action==='reload-user'&&selected){await openUser(selected.id);return;}
   if(action.startsWith('edit-'))edit(action.slice(5));
  }catch(error){notify(error.message);}
 }
 function change(target){
  if(!active)return;
  if(target.id==='adm-user-filter'||target.id==='adm-user-sort'){
   state[target.id==='adm-user-filter'?'filter':'sort']=target.value;state.page=1;load();
  }
  if(target.closest('[data-admin-form="user"]')){
   if(target.name==='mode')target.form.elements.amount.value=target.value==='add'?'0':String(selected.credits);
   preview(target.form);
  }
 }
 function preview(form){
  if(!form||form.dataset.kind!=='credits'||!selected)return;
  const mode=form.elements.mode.value,amount=form.elements.amount;
  if(mode==='add'){amount.min='-1000000000';}else amount.min='0';
  const n=Number(amount.value),after=mode==='set'?n:selected.credits+n,target=form.querySelector('#adm-credit-after');
  if(target){target.textContent=Number.isSafeInteger(after)&&after>=0&&after<=1000000000?after.toLocaleString('zh-CN'):'数额无效';target.classList.toggle('adm-invalid',!Number.isSafeInteger(after)||after<0||after>1000000000);}
 }
 function input(target){if(target.closest('[data-admin-form="user"]'))preview(target.form);}
 async function submit(form){
  if(!active||working)return;
  if(!form.reportValidity())return;
  const values=Object.fromEntries(new FormData(form)),type=form.dataset.adminForm;
  if(type==='search'){
   if(section==='users'){state.q=values.q;state.page=1;}else{state.auditQ=values.q;state.auditPage=1;}await load();return;
  }
  working=true;const run=generation,submit=form.querySelector('[type="submit"]');submit.disabled=true;
  form.querySelector('.adm-form-error').textContent='';
  try{
   if(type==='login'){
    const user=await api('/auth/login',values);if(!active||run!==generation)return;setUser(user);await open('overview');return;
   }
   if(type==='user'){
    const p=selected,kind=form.dataset.kind;
    const payload={requestId:operationId,reason:values.reason};
    if(kind==='credits')Object.assign(payload,{mode:values.mode,amount:Number(values.amount),revision:p.revision});
    else if(kind==='profile')Object.assign(payload,{name:values.name,bio:values.bio,revision:p.revision});
    else Object.assign(payload,{action:kind,accessRevision:p.accessRevision,...(kind==='role'?{value:p.role==='admin'?'player':'admin'}:kind==='disabled'?{value:!p.disabled}:{})});
    const result=await api(`/admin/users/${encodeURIComponent(p.id)}/${kind==='credits'?'credits':kind==='profile'?'profile':'access'}`,payload);
    if(!active||run!==generation)return;
    if(result.id===getUser()?.id)setUser(result.profile);
    close();notify('用户信息已更新');await load();return;
   }
   if(type==='ai'){
    if(!form.dataset.requestId)form.dataset.requestId=requestId();
    const result=await api('/admin/ai',{settings:{enabled:form.elements.enabled.checked,baseUrl:values.baseUrl,model:values.model,apiKey:values.apiKey,clearApiKey:!!form.elements.clearApiKey?.checked,contextTokens:Number(values.contextTokens),temperature:values.temperature.trim()===''?null:Number(values.temperature),dmStylePrompt:values.dmStylePrompt},reason:values.reason,revision:Number(form.dataset.revision),requestId:form.dataset.requestId});
    if(!active||run!==generation)return;
    data=result;show();notify('AI DM 配置已保存，后续请求立即生效');return;
   }
   if(type==='settings'){
    const settings={...data.settings};
    for(const [key,value]of Object.entries(settings))settings[key]=typeof value==='boolean'?form.elements[key].checked:typeof value==='number'?Number(values[key]):values[key];
    if(!form.dataset.requestId)form.dataset.requestId=requestId();
    const result=await api('/admin/settings',{settings,reason:values.reason,revision:Number(form.dataset.revision),requestId:form.dataset.requestId});
    if(!active||run!==generation)return;
    data=result;show();await onSettingsChanged();notify('系统设置已保存并生效');
   }
  }catch(error){
   if(!active||run!==generation)return;
   const inline=form.querySelector('.adm-form-error');if(inline){inline.textContent=error.message;if(error.status===409)inline.insertAdjacentHTML('beforeend',button('重新载入',type==='user'?'reload-user':'reload-settings','class="adm-text"'));}else notify(error.message);
  }finally{working=false;if(submit.isConnected)submit.disabled=false;}
 }
 return {open,handle,submit,change,input,dispose,get active(){return active;}};
}
