import {spawn} from 'node:child_process';
const children=[spawn(process.execPath,['scripts/build-web.mjs','--watch'],{stdio:'inherit',windowsHide:true}),spawn(process.execPath,['--watch','apps/server/index.js'],{stdio:'inherit',windowsHide:true})];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill();process.exitCode=code;}
for(const child of children){child.on('error',error=>{console.error(error.message);stop(1);});child.on('exit',code=>stop(code??0));}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
