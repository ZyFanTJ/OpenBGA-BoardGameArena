import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { adventures } from '../packages/games/dnd/adventures/index.js';
import { sceneArt, sceneCast, actorImage, enemyImage } from '../apps/web/games/dnd/art.js';
import { createApp } from '../apps/server/http.js';
import { games } from '../packages/games/registry.js';
import { JsonStore } from '../packages/platform/store.js';

test('Every playable scene has a versioned raster asset; published art matches its manifest',async()=>{
  const manifest=JSON.parse(await fs.readFile(new URL('../assets/dnd/manifest.json',import.meta.url)));
  const ids=Object.values(adventures).flatMap(a=>Object.keys(a.scenes));
  assert.deepEqual(Object.keys(sceneArt).sort(),ids.sort());
  const paths=new Set(manifest.assets.map(a=>'/'+a.path.replace('apps/web/','')));
  for(const url of Object.values(sceneArt)) assert.ok(paths.has(url),url);
  for(const asset of manifest.assets){
    assert.ok(asset.path.startsWith('apps/web/assets/dnd/'));assert.ok(asset.width>0&&asset.height>0);
    const bytes=await fs.readFile(new URL('../'+asset.path,import.meta.url));
    assert.equal(bytes.length,asset.bytes);assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  }
});

test('Art only draws NPCs present in the public view, and never invents a new actor for unknown data',()=>{
  const s={scene:{id:'banquet'},world:{entities:[{name:'水中蛾',state:'正在耍剑'}]},combat:null};
  const html=sceneCast(s);
  assert.match(html,/actors\/jester-v1.webp/);assert.ok(!html.includes('fairy-lord'));assert.ok(!html.includes('girl-v1'));
  assert.equal(sceneCast({...s,combat:{enemies:[]}}),'');
  assert.equal(actorImage('../secret'),'');assert.equal(enemyImage('village',{name:'unknown'}),'');
});

test('Browser art is served as WebP while source atlases remain outside the web root',async t=>{
  const app=createApp({store:new JsonStore(),registry:games,random:()=>.8});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  t.after(async()=>{app.closeStreams();await new Promise(r=>app.server.close(r));});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  for(const asset of ['/assets/dnd/scenes/banquet-v1.webp','/assets/dnd/actors/fighter-v1.webp','/assets/dnd/portraits/wizard-v1.webp','/assets/dnd/foes/stirge-v1.webp','/assets/dnd/props/thread-v1.webp','/assets/dnd/covers/morgansfort-v1.webp']){
    const r=await fetch(base+asset);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/webp/);assert.ok((await r.arrayBuffer()).byteLength>0);
  }
  assert.equal((await fetch(base+'/assets/dnd/source-atlases/characters-v1.png')).status,404);
  assert.equal((await fetch(base+'/games/dnd/art.css')).status,200);
});
