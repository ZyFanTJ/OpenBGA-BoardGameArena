import test from 'node:test';
import assert from 'node:assert/strict';
import {loadHubPage} from '../apps/web/hub/data.js';
import {lazySurface} from '../apps/web/lazy-surface.js';
import {api} from '../apps/web/api.js';

test('shop and history do not wait for unrelated social services', async () => {
  const calls = [];
  const api = async path => { calls.push(path); if (path.startsWith('/history')) return {items:[]}; if (path === '/shop') return {items:[]}; throw new Error('unrelated service down'); };
  assert.deepEqual(await loadHubPage(api, 'shop'), {shop:{items:[]}});
  assert.deepEqual(await loadHubPage(api, 'history', {filters:{game:'cabo'}}), {history:{items:[]}});
  assert.deepEqual(calls, ['/shop','/history?game=cabo']);
});

test('profile and friends retain cosmetic metadata without fetching all history', async () => {
  const calls = [], api = async path => { calls.push(path); return path; };
  assert.deepEqual(await loadHubPage(api, 'profile', {target:'friend'}), {shop:'/shop',profilePage:'/profiles/friend'});
  assert.deepEqual(await loadHubPage(api, 'friends'), {shop:'/shop',friends:'/friends'});
  assert.equal(calls.some(path => path.startsWith('/history')), false);
});

test('leaving a lazy page before import completes cannot reopen it, and import is reused', async () => {
  let complete, loads=0, opens=0, changes=0;
  const surface = lazySurface(() => { loads++; return new Promise(resolve => { complete=resolve; }); });
  const first=surface.open(); surface.dispose();
  complete({open(){opens++;},dispose(){},change(){changes++;}}); await first;
  assert.equal(opens,0); await surface.open(); surface.change();
  assert.equal(opens,1); assert.equal(loads,1); assert.equal(changes,1);
});

test('failed lazy page imports are retryable', async () => {
  let loads=0;
  const surface=lazySurface(async()=>{if(++loads===1)throw new Error('offline');return {open:()=>42};});
  await assert.rejects(surface.open(),/offline/); assert.equal(surface.active,false);
  assert.equal(await surface.open(),42);
});

test('concurrent reads share one request, but writes and completed reads cannot reuse stale account data',async t=>{
  const original=globalThis.fetch,requests=[];t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=()=>new Promise(resolve=>requests.push(resolve));
  const first=api('/shop'),duplicate=api('/shop');assert.equal(first,duplicate);assert.equal(requests.length,1);
  const write=api('/auth/logout',{}),fresh=api('/shop');assert.equal(requests.length,3);assert.notEqual(fresh,first);
  const respond=(index,value)=>requests[index]({ok:true,status:200,text:async()=>JSON.stringify(value)});
  respond(0,{account:'old'});await first;assert.equal(api('/shop'),fresh);
  respond(1,{ok:true});respond(2,{account:'new'});await write;assert.deepEqual(await fresh,{account:'new'});
  const next=api('/shop');assert.equal(requests.length,4);respond(3,{account:'latest'});await next;
});
