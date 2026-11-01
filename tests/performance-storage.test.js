import test from 'node:test';
import assert from 'node:assert/strict';
import {SqliteStore} from '../packages/platform/sqlite-store.js';
import {transactionDraft} from '../packages/platform/transaction-draft.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {BotRunner} from '../packages/platform/bots.js';

test('committed indexes track membership, replacements and deletes while failed writes leave them unchanged', t => {
  const store=new SqliteStore();t.after(()=>store.close());
  const keys=r=>r.players.map(p=>p.id),lookup=id=>store.selectRecords('rooms','test-player',keys,id);
  assert.deepEqual(lookup('a'),[]);
  store.transaction(d=>{d.rooms.one={players:[{id:'a'}]};});assert.equal(lookup('a').length,1);
  const persist=store.persist.bind(store);store.persist=()=>{throw new Error('disk');};
  assert.throws(()=>store.transaction(d=>{d.rooms.one.players[0].id='b';}),/disk/);
  assert.equal(lookup('a').length,1);assert.deepEqual(lookup('b'),[]);store.persist=persist;
  store.transaction(d=>{d.rooms.one.players[0].id='b';});assert.deepEqual(lookup('a'),[]);assert.equal(lookup('b').length,1);
  store.transaction(d=>{d.rooms={two:{players:[{id:'c'}]}};});assert.deepEqual(lookup('b'),[]);assert.equal(lookup('c').length,1);
  store.transaction(d=>{delete d.rooms.two;});assert.deepEqual(lookup('c'),[]);
});

test('editing a forum topic neither clones nor serializes unrelated topic bodies',t=>{
  const store=new SqliteStore();t.after(()=>store.close());
  store.transaction(d=>{d.forum.topics.one={revision:0};d.forum.topics.other={body:'large'};});
  const other=store.data.forum.topics.other;
  Object.defineProperty(other,'body',{enumerable:true,get(){throw new Error('unrelated topic accessed');}});
  const writes=[],persist=store.persist.bind(store);store.persist=changes=>{writes.push(changes);persist(changes);};
  store.transaction(d=>{d.forum.topics.one.revision++;});
  assert.equal(store.data.forum.topics.other,other);assert.equal(writes.at(-1).length,1);
  assert.equal(writes.at(-1)[0].collection,'forumTopics');
  assert.throws(()=>store.transaction(d=>{d.forum.topics.one.revision++;d.forum.nextNumber++;throw new Error('rollback');}),/rollback/);
  assert.equal(store.data.forum.topics.one.revision,1);assert.equal(store.data.forum.nextNumber,1);
  const draft=transactionDraft(store.data).draft;assert.equal(Object.hasOwn(draft,'forumTopics'),false);assert.equal(Object.hasOwn(draft.forum,'topics'),true);
});

test('legacy SQLite forum singleton migrates atomically and topic edits, replacements and deletions survive reopening',t=>{
  mkdirSync('work',{recursive:true});const dir=mkdtempSync(resolve('work/forum-layout-')),file=join(dir,'data.sqlite');
  let store=new SqliteStore(file);t.after(()=>{store?.close();rmSync(dir,{recursive:true,force:true});});
  store.close();store=null;
  const db=new DatabaseSync(file);db.prepare("UPDATE records SET json=? WHERE collection='' AND id='forum'").run(JSON.stringify({nextNumber:2,topics:{one:{revision:0,body:'preserved'}}}));db.close();
  store=new SqliteStore(file);assert.equal(store.data.forum.topics.one.body,'preserved');
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM records WHERE collection='forumTopics'").get().n,1);
  assert.equal(Object.hasOwn(JSON.parse(store.db.prepare("SELECT json FROM records WHERE collection='' AND id='forum'").get().json),'topics'),false);
  store.transaction(d=>{d.forum.nextNumber++;d.forum.topics.one.revision++;d.forum.topics.two={body:'new'};});
  store.close();store=new SqliteStore(file);assert.equal(store.data.forum.topics.one.revision,1);assert.equal(store.data.forum.nextNumber,3);
  store.transaction(d=>{d.forum={nextNumber:4,topics:{three:{body:'replacement'}}};});
  store.close();store=new SqliteStore(file);assert.deepEqual(store.data.forum,{nextNumber:4,topics:{three:{body:'replacement'}}});
  store.transaction(d=>{delete d.forum.topics.three;});store.close();store=new SqliteStore(file);assert.deepEqual(store.data.forum.topics,{});
});

test('bot observation stays in commit order while decisions wait until after the response and discard obsolete revisions',async t=>{
  const events=[],room={status:'playing',revision:1,stateVersion:1,game:{},players:[{id:'bot',isBot:true}]};
  const game={manifest:{stateVersion:1},view:()=>({redacted:true}),bot:{observe(view){events.push('observe');assert.deepEqual(view,{redacted:true});return {};},decide(){events.push('decide');return {type:'play'};}}};
  const rooms={store:{data:{rooms:{one:room}}},registry:{get:()=>game},mutate(){events.push('mutate');}};
  const runner=new BotRunner(rooms,{delay:10});t.after(()=>runner.stop());
  runner.sync('one');assert.deepEqual(events,['observe']);
  room.revision++;runner.sync('one');assert.deepEqual(events,['observe','observe']);
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.deepEqual(events,['observe','observe','decide','mutate']);
});
