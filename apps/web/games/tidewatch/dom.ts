/** Keep live controls mounted while 5Hz snapshots update their labels and prices. */
export function patchHTML(target:Element,html:string){
 const template=document.createElement('template');template.innerHTML=html;
 const identity=(el:Element)=>['action','sector','pad','kind','tower','branch','skill','relic','tab','target','card','recipe','offer','choice','gift','bounty','faction','to'].map(key=>el.getAttribute(`data-${key}`)??'').join('|');
 function patch(parent:Node,source:Node){
  const wanted=[...source.childNodes];
  for(let i=0;i<wanted.length;i++){
   const fresh=wanted[i],old=parent.childNodes[i];
   if(!old){parent.appendChild(fresh.cloneNode(true));continue;}
   if(old.nodeType!==fresh.nodeType||old.nodeName!==fresh.nodeName||(old instanceof Element&&fresh instanceof Element&&identity(old)!==identity(fresh))){parent.replaceChild(fresh.cloneNode(true),old);continue;}
   if(fresh.nodeType===Node.TEXT_NODE){if(old.textContent!==fresh.textContent)old.textContent=fresh.textContent;continue;}
   if(old instanceof Element&&fresh instanceof Element){
    for(const attr of [...old.attributes])if(!fresh.hasAttribute(attr.name)&&!['data-pending','aria-busy'].includes(attr.name))old.removeAttribute(attr.name);
    for(const attr of [...fresh.attributes])if(old.getAttribute(attr.name)!==attr.value)old.setAttribute(attr.name,attr.value);
    patch(old,fresh);
   }
  }
  while(parent.childNodes.length>wanted.length)parent.lastChild!.remove();
 }
 patch(target,template.content);
}
