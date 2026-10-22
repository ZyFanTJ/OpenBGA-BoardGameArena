import fs from 'node:fs';
import {dirname} from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {createTextProvider} from './ai-provider.js';

const memoryKeys=new WeakMap();
/** Encryption keys live beside the store, outside every client projection and image. */
export function createProviderSecrets(store){
 let key;
 function getKey(){
  if(key)return key;
  if(!store.file){if(!memoryKeys.has(store))memoryKeys.set(store,randomBytes(32));return key=memoryKeys.get(store);}
  const path=store.secretsFile??store.file+'.secrets.key';fs.mkdirSync(dirname(path),{recursive:true});
  try{fs.writeFileSync(path,randomBytes(32),{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;}
  key=fs.readFileSync(path);if(key.length!==32)throw new Error('Invalid integration encryption key');return key;
 }
 return {
  seal(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',getKey(),iv),bytes=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return {iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:bytes.toString('base64')};},
  open(value){const decipher=createDecipheriv('aes-256-gcm',getKey(),Buffer.from(value.iv,'base64'));decipher.setAuthTag(Buffer.from(value.tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8');},
 };
}
/** Resolve the current administrator configuration for each new request. */
export function configuredTextProvider(store,secrets,{environment={},fetchImpl}={}){
 let revision,provider;
 const resolveProvider=()=>{
  const config=store.data.integrations;
  if(revision!==config.revision){
   const s=config.textProvider;
   const generation={contextTokens:s.contextTokens,temperature:s.temperature,dmStylePrompt:s.dmStylePrompt};
   provider=config.revision===0?createTextProvider({...environment,...generation,fetchImpl}):s.enabled&&s.encryptedKey&&s.model?createTextProvider({apiKey:secrets.open(s.encryptedKey),baseUrl:s.baseUrl,model:s.model,...generation,fetchImpl}):null;
   revision=config.revision;
  }
  return provider;
 };
 const invoke=(input,context)=>{const current=resolveProvider();return current?current(input,context):{source:'local',value:null};};
 invoke.resolve=resolveProvider;
 return invoke;
}
