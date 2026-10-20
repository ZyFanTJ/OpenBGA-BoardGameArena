import {spawnSync,spawn} from 'node:child_process';
import {createReadStream,createWriteStream,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [command='build',reference='happy-online:0.5.1']=process.argv.slice(2);
function run(args){const result=spawnSync('docker',args,{cwd:root,stdio:'inherit',shell:false});if(result.error)throw result.error;if(result.status!==0)throw new Error(`Docker exited with ${result.status}`);}
function validImage(value){if(!/^[a-z0-9][a-z0-9._:/-]*:[a-zA-Z0-9_.-]+$/.test(value))throw new Error('Use a full image name with an explicit tag.');return value;}
try{
 validImage(reference);
 if(command==='build')run(['build','--platform','linux/amd64','--target','runtime','-t',reference,'.']);
 else if(command==='deploy')run(['compose','up','-d','--build','--wait']);
 else if(command==='push'){
  if(!process.argv[3]||!reference.includes('/'))throw new Error('Provide your registry/account/image:tag, after docker login.');
  run(['tag','happy-online:0.5.1',reference]);run(['push',reference]);
 }else if(command==='package'){
  run(['image','inspect','--format','{{.Id}}',reference]);mkdirSync(resolve(root,'dist'),{recursive:true});
  const output=resolve(root,'dist/happy-online-0.5.1-linux-amd64.tar.gz');
  const child=spawn('docker',['save',reference],{cwd:root,stdio:['ignore','pipe','inherit'],shell:false});
  const done=new Promise((yes,no)=>{child.on('error',no);child.on('close',code=>code===0?yes():no(new Error(`docker save exited with ${code}`)));});
  await Promise.all([pipeline(child.stdout,createGzip({level:6}),createWriteStream(output)),done]);
  const hash=createHash('sha256');for await(const chunk of createReadStream(output))hash.update(chunk);
  writeFileSync(output+'.sha256',`${hash.digest('hex')}  happy-online-0.5.1-linux-amd64.tar.gz\n`);console.log(`Saved ${output}`);
 }else throw new Error('Use build, deploy, package, or push.');
}catch(error){console.error(error.message);process.exitCode=1;}
