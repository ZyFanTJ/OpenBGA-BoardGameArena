import {ensure} from './errors.js';

export const defaultDmStylePrompt='像一位善于即兴的真人地下城主。用具体的感官细节、人物对白与行动后果呈现场景；让NPC有自己的愿望与反应。尊重玩家的自由选择，接住合理的新点子，不强迫回到预设路线。叙述紧凑，避免重复规则说明、冗长抒情或替玩家决定行动。';
export const defaultTextProvider=()=>({enabled:false,baseUrl:'https://api.openai.com/v1',model:'',encryptedKey:null,contextTokens:100000,temperature:1,dmStylePrompt:defaultDmStylePrompt});
export function textProviderView(data){
 const s=data.integrations.textProvider;
 return {revision:data.integrations.revision,enabled:s.enabled,baseUrl:s.baseUrl,model:s.model,contextTokens:s.contextTokens,temperature:s.temperature,dmStylePrompt:s.dmStylePrompt,hasApiKey:!!s.encryptedKey,configured:!!(s.enabled&&s.model&&s.encryptedKey)};
}
export function validateTextProvider(input,defaults=defaultTextProvider()){
 ensure(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>['enabled','baseUrl','model','apiKey','clearApiKey','contextTokens','temperature','dmStylePrompt'].includes(k)),'AI 服务设置无效');
 ensure(typeof input.enabled==='boolean'&&typeof input.baseUrl==='string'&&input.baseUrl.length<=500&&typeof input.model==='string'&&input.model.length<=120,'AI 服务设置无效');
 let url;try{url=new URL(input.baseUrl.trim());}catch{ensure(false,'请输入有效的 HTTPS 服务地址');}
 ensure(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash,'服务地址需为 HTTPS，且不能包含账号、参数或片段');
 ensure(!/[\s\x00-\x1f\x7f]/.test(input.model.trim()),'模型名称不能包含空白或控制字符');
 const apiKey=input.apiKey??'';ensure(typeof apiKey==='string'&&apiKey.length<=2048&&!/[\s\x00-\x1f\x7f]/.test(apiKey),'密钥格式无效');
 ensure(input.clearApiKey===undefined||typeof input.clearApiKey==='boolean','清除密钥选项无效');
 ensure(!(input.clearApiKey&&apiKey),'不能同时替换和清除密钥');
 const contextTokens=input.contextTokens===undefined?defaults.contextTokens:input.contextTokens;
 const temperature=input.temperature===undefined?defaults.temperature:input.temperature,dmStylePrompt=input.dmStylePrompt===undefined?defaults.dmStylePrompt:input.dmStylePrompt;
 ensure(Number.isSafeInteger(contextTokens)&&contextTokens>=4096&&contextTokens<=1000000,'上下文需为 4,096–1,000,000 token 的整数');
 ensure(temperature===null||typeof temperature==='number'&&Number.isFinite(temperature)&&temperature>=0&&temperature<=2,'温度需为 0–2，或留空使用模型默认值');
 ensure(typeof dmStylePrompt==='string'&&dmStylePrompt.length<=1000&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(dmStylePrompt),'DM 风格提示词最多 1,000 字');
 return {enabled:input.enabled,baseUrl:url.href.replace(/\/+$/,''),model:input.model.trim(),apiKey,clearApiKey:!!input.clearApiKey,contextTokens,temperature,dmStylePrompt:dmStylePrompt.trim()};
}
