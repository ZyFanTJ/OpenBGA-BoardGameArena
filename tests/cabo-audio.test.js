import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transitionSound, soundFiles, createCaboAudio} from '../apps/web/games/cabo/audio.js';
import {createTableAnimator} from '../apps/web/games/cabo-motion.js';
import {createApp} from '../apps/server/http.js';
import {JsonStore} from '../packages/platform/store.js';
import {games} from '../packages/games/registry.js';

test('HTTP serves the selected audio as MPEG without exposing private assets', async t => {
  const app=createApp({store:new JsonStore(),registry:games});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{app.closeStreams();await new Promise(resolve=>app.server.close(resolve));});
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  for(const file of ['periwinkle.mp3','card-slide-1.mp3']){
    const response=await fetch(`${origin}/assets/cabo/audio/${file}`);
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'audio/mpeg');
    assert.ok((await response.arrayBuffer()).byteLength>100);
  }
});

test('audio files exist and sound selection is independent of hidden card values', async () => {
  for (const file of ['periwinkle.mp3', ...Object.values(soundFiles)]) {
    const bytes = await readFile(new URL('../apps/web/assets/cabo/audio/' + file, import.meta.url));
    assert.ok(bytes.length > 100); assert.notEqual(bytes[0], 60, 'not an HTML download error');
  }
  const previous = {phase:'turn'};
  for (const value of [null,0,13]) assert.equal(transitionSound(previous,{phase:'drawn',drawn:{value},motion:{kind:'draw'}},'a'), 'draw');
  assert.equal(transitionSound(null,{motion:{kind:'draw'}},'a'),null);
  assert.equal(transitionSound(previous,{phase:'finished',winners:['a']},'a','end'),'win');
  assert.equal(transitionSound(previous,{phase:'finished',winners:['b']},'a','end'),'result');
  assert.equal(transitionSound({phase:'roundEnd'},{phase:'finished',winners:['a']},'a','end'),null);
});

test('display timeline suppresses duplicate, initial, recovery, hidden and skipped-revision sounds with reduced motion', () => {
  const originals={window:globalThis.window,document:globalThis.document,matchMedia:globalThis.matchMedia};
  globalThis.window=new EventTarget(); globalThis.document=Object.assign(new EventTarget(),{hidden:false});
  globalThis.matchMedia=()=>Object.assign(new EventTarget(),{matches:true});
  const target={querySelectorAll:()=>[],contains:()=>false,classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}};
  const sounds=[],animator=createTableAnimator(()=>'',(prev,next,user,stage)=>{if(stage==='start')sounds.push(next.value);});
  const s=(revision,value)=>({revision,players:[],game:{value,phase:'turn',motion:{kind:'draw'}}});
  try {
    animator.update(target,s(1,1),{});
    animator.update(target,s(2,2),{}); animator.update(target,s(2,2),{});
    animator.update(target,s(4,4),{});
    animator.update(target,s(5,5),{},{resetAnimations:true});
    document.hidden=true;animator.update(target,s(6,6),{});
    document.hidden=false;animator.update(target,s(7,7),{});
    assert.deepEqual(sounds,[2,7]);
  } finally {animator.dispose();Object.assign(globalThis,originals);}
});

test('music starts on gesture, honors switches, pauses in background and releases on dispose', async () => {
  const keys=['window','document','Audio','localStorage','fetch'];
  const originals=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  let music,requests=0,saved;
  globalThis.window={};globalThis.document=Object.assign(new EventTarget(),{hidden:false});
  globalThis.localStorage={getItem:()=>'{"musicVolume":22}',setItem:(key,value)=>saved=JSON.parse(value)};
  globalThis.fetch=()=>{requests++;throw new Error('unexpected');};
  globalThis.Audio=class extends EventTarget {constructor(){super();music=this;this.paused=true;} play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){}load(){}};
  const container=Object.assign(new EventTarget(),{querySelector:()=>null,querySelectorAll:()=>[]});
  let audio;
  try {
    audio=createCaboAudio(container);assert.equal(music.paused,true);assert.equal(requests,0);
    container.dispatchEvent(new Event('pointerdown'));await new Promise(setImmediate);
    assert.equal(music.paused,false);assert.equal(music.loop,true);assert.equal(music.volume,.22);
    document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(music.paused,true);
    document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));await new Promise(setImmediate);assert.equal(music.paused,false);
    const input=new Event('input');Object.defineProperty(input,'target',{value:{dataset:{caboAudio:'music'},type:'checkbox',checked:false}});
    container.dispatchEvent(input);assert.equal(music.paused,true);assert.equal(saved.music,false);
    audio.dispose();container.dispatchEvent(new Event('pointerdown'));assert.equal(music.paused,true);
  } finally {audio?.dispose();Object.assign(globalThis,originals);}
});
