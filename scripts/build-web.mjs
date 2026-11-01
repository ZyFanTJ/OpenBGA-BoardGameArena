import {build,context} from 'esbuild';
const options={entryPoints:['apps/web/lobby/app.jsx'],outfile:'apps/web/dist/lobby.js',bundle:true,format:'esm',platform:'browser',target:['es2022'],jsx:'automatic',minify:true,legalComments:'linked',external:['../hub/cosmetics.js','../lobby-sidebar.js','../room-browser.js','../ui.js','../api.js'],define:{'process.env.NODE_ENV':'"production"'},metafile:true,logLevel:'info'};
const tidewatch={entryPoints:['apps/web/games/tidewatch/index.ts'],outfile:'apps/web/dist/tidewatch.js',bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,legalComments:'linked',metafile:true,logLevel:'info'};
const tidewatchGuide={...tidewatch,entryPoints:['apps/web/games/tidewatch/guide.js'],outfile:'apps/web/dist/tidewatch-guide.js'};
if(process.argv.includes('--watch')){for(const config of [options,tidewatch,tidewatchGuide]){const ctx=await context(config);await ctx.watch();}}
else{
 const result=await build(options);
 await build(tidewatch);
 await build(tidewatchGuide);
 const bytes=Object.values(result.metafile.outputs).reduce((n,file)=>n+file.bytes,0);
 console.log(`Lobby bundle: ${(bytes/1024).toFixed(1)} KiB (before HTTP compression)`);
}
