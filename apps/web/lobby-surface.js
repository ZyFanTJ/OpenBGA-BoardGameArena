import {createLobbyStore} from './lobby/state.js';
import {lobbyDialogs} from './lobby.js';
import {api} from './api.js';
let bundle;
const load=()=>bundle??=import('./dist/lobby.js').catch(error=>{bundle=null;throw error;});
export const lobbyFrame=(user,games,metadata)=>`<main class="moon-lobby modern-lobby"><div id="react-lobby" class="ml-mount"><div class="ml-loading" role="status"><span></span><p>正在打开大厅…</p></div></div></main>${lobbyDialogs(user,games,metadata,{joinInDialog:true})}`;

/** Keep the page shell and native room forms available while React loads. */
export function createLobbySurface(root,initial,{onError=()=>{},loader=load}={}){
 const container=root.querySelector('#react-lobby'),store=createLobbyStore(initial);
 const search=root.querySelector('#lobby-search');
 store.subscribe(()=>{if(search&&search.value!==store.getSnapshot().query)search.value=store.getSnapshot().query;});
 let renderer,disposed=false;
 const ready=loader().then(module=>{
  if(disposed||!container.isConnected)return;
  renderer=module.mountLobby(container,store);
 }).catch(error=>{
  if(disposed||!container.isConnected)return;
  container.innerHTML='<div class="ml-loading" role="alert"><p>大厅加载失败</p><button data-action="lobby-home">重试</button></div>';
  onError(error.message);
 });
 return {
  ready,
  filter(){store.patch({query:root.querySelector('#lobby-search')?.value??'',page:0});},
  updateRooms:rooms=>store.patch({rooms}),
  updateCurrentRoom:currentRoomId=>store.patch({currentRoomId}),
  updateGames:games=>store.patch({games}),
  updateFriends:friends=>store.patch({friends}),
  updateRecent:recent=>store.patch({recent}),
  page:delta=>store.patch({page:Math.max(0,store.getSnapshot().page+delta)}),
  dispose(){disposed=true;renderer?.dispose();store.dispose();},
 };
}
export const directoryFrame=(user,games,metadata)=>`<main class="room-browser modern-directory" aria-labelledby="room-browser-title"><div id="react-directory"><div class="ml-loading" role="status"><span></span><p>正在寻找牌桌…</p></div></div></main>${lobbyDialogs(user,games,metadata,{joinInDialog:true})}`;
export function createDirectorySurface(root,initial,{onError=()=>{}}={}){
 const container=root.querySelector('#react-directory'),store=createLobbyStore({loading:true,error:'',gameId:'',status:'all',...initial});
 let renderer,disposed=false,pending;
 const ready=load().then(module=>{if(!disposed&&container.isConnected)renderer=module.mountDirectory(container,store);}).catch(error=>{if(!disposed){container.innerHTML='<div class="ml-loading" role="alert"><p>房间列表加载失败</p><button data-action="my-room">重试</button></div>';onError(error.message);}});
 function refresh(){
  if(pending)return pending;
  store.patch({loading:true,error:''});
  pending=api('/lobby').then(data=>{if(!disposed)store.patch({rooms:data.rooms,loaded:true});}).catch(()=>{if(!disposed)store.patch({error:'房间列表暂时无法更新'});}).finally(()=>{pending=null;if(!disposed)store.patch({loading:false});});
  return pending;
 }
 const timer=setInterval(()=>{if(!document.hidden&&!root.querySelector('dialog[open]')&&!container.contains(document.activeElement))refresh();},30000);
 refresh();
 return {ready,refresh,search(query){store.patch({query,page:0});},handle(){},dispose(){disposed=true;clearInterval(timer);renderer?.dispose();store.dispose();}};
}
