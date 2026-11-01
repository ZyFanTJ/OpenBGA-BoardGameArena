import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {brotliCompressSync, constants} from 'node:zlib';
import {SqliteStore} from '../packages/platform/sqlite-store.js';
import {RecordService} from '../packages/platform/records.js';
import {transactionDraft} from '../packages/platform/transaction-draft.js';
import {games} from '../packages/games/registry.js';
import {createApp} from '../apps/server/http.js';
const web=resolve('apps/web');
function graph(entry, type) {
 const seen=new Set();
 function visit(file){if(seen.has(file))return;seen.add(file);const source=readFileSync(file,'utf8');
 const regex=type==='js'?/\b(?:import|export)\s+(?:[^;'"\n]*?\s+from\s*)?['"]([^'"]+)['"]/g:/@import\s+url\(['"]([^'"]+)['"]\)/g;
 for(const m of source.matchAll(regex)){if(type==='js'&&!m[1].startsWith('.'))continue;visit(m[1].startsWith('/')?resolve(web,'.'+m[1]):resolve(dirname(file),m[1]));}}
 visit(resolve(web,entry));let raw=0,br=0;for(const f of seen){const b=readFileSync(f);raw+=b.length;br+=brotliCompressSync(b,{params:{[constants.BROTLI_PARAM_QUALITY]:5}}).length;}
 return {files:seen.size,rawBytes:raw,brotliBytes:br};
}
console.log(JSON.stringify({js:graph('app.js','js'),css:graph('styles.css','css')},null,2));
function measure(fn){fn();const t=[];for(let i=0;i<11;i++){const start=performance.now();fn();t.push(performance.now()-start);}t.sort((a,b)=>a-b);return {medianMs:+t[5].toFixed(2),maxMs:+t.at(-1).toFixed(2)};}
const store=new SqliteStore();const records=new RecordService(store,games);
for(const count of [1000,10000,50000]){
 store.transaction(data => { data.matches=Object.fromEntries(Array.from({length:count},(_,i)=>['m'+i,{id:'m'+i,gameId:'cabo',endedAt:i,practice:true,participants:[{id:i%10===0?'audit-user':'other',isBot:false,won:i%3===0}]}])); });
 console.log(JSON.stringify({case:'history, 10% owned',count,...measure(()=>records.list({id:'audit-user'}))}));
}
store.transaction(data => { data.matches={}; });
for(const count of [1000,10000]){
 store.data.forum={nextNumber:count+1,topics:Object.fromEntries(Array.from({length:count},(_,i)=>['t'+i,{id:'t'+i,body:'x'.repeat(1000),replies:[],supporters:[],revision:0}]))};
 console.log(JSON.stringify({case:'forum single revision draft+diff only; no disk',count,bytes:Buffer.byteLength(JSON.stringify(store.data.forum)),...measure(()=>{const d=transactionDraft(store.data);d.draft.forum.topics.t0.revision++;d.changes();})}));
}
store.close();
const httpStore=new SqliteStore();const app=createApp({store:httpStore,registry:games});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
try{
 const session=await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Performance audit'})});await session.text();const cookie=session.headers.get('set-cookie').split(';')[0];
 for(const path of ['/api/games','/api/system','/api/me','/api/hub','/api/shop','/api/friends','/api/history','/api/profile']){
 const times=[];let bytes,status;for(let i=0;i<12;i++){const t=performance.now();const res=await fetch(base+path,{headers:{cookie}});bytes=Buffer.byteLength(await res.text());status=res.status;if(i)times.push(performance.now()-t);}times.sort((a,b)=>a-b);
 console.log(JSON.stringify({path,status,bytes,medianMs:+times[5].toFixed(2),maxMs:+times.at(-1).toFixed(2)}));}
}finally{app.closeStreams();await new Promise(r=>app.server.close(r));httpStore.close();}
