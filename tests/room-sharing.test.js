import test from 'node:test';
import assert from 'node:assert/strict';
import {inviteLink,roomSharePayload,joinInvitation} from '../apps/web/table-social.js';

test('room invitation shares a direct link and useful text for group chats without private fields',()=>{
  const room={id:'ABCD1234',title:'今晚玩 UNO',players:[{name:'private'}],game:{secret:123}};
  const payload=roomSharePayload(room,'https://table.example');
  assert.equal(payload.url,'https://table.example/#invite/ABCD1234');
  assert.match(payload.text,/今晚玩 UNO/);assert.match(payload.text,/无需注册/);
  assert.doesNotMatch(JSON.stringify(payload),/private|secret/);
  assert.equal(inviteLink('ABCD1234','https://table.example'),payload.url);
});
test('invitation entry joins with the latest revision, retries a single race and propagates closed/full rooms',async()=>{
  const calls=[];let reads=0,joins=0;
  const request=async(path,data)=>{calls.push([path,data]);if(!data)return {revision:++reads};if(++joins===1)throw Object.assign(new Error('stale'),{status:409});return {id:'ABCD1234'};};
  assert.deepEqual(await joinInvitation('ABCD1234',request),{id:'ABCD1234'});
  assert.deepEqual(calls.filter(([,data])=>data).map(([,data])=>data.revision),[1,2]);
  const full=Object.assign(new Error('房间已满'),{status:400});let attempts=0;
  await assert.rejects(joinInvitation('ABCD1234',async(_,data)=>{if(!data)return {revision:4};attempts++;throw full;}),/房间已满/);assert.equal(attempts,1);
});
