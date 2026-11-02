import {parseHTML} from 'linkedom';
import {safePath} from './protocol';

// Authenticated, account-scoped HTML evidence. Never execute or expose scripts,
// hidden controls, credentials or arbitrary destinations.
export function inspectAcademicHTML(html:string,origin:string){
 const root=parseHTML(html).document;
 const redact=(value:string)=>value.replace(/;jsessionid=[^?&#"'\s]+/gi,';jsessionid=[redacted]').replace(/([?&](?:token|csrf|session|password|senha|secret)=)[^&#\s]*/gi,'$1[redacted]');
 const embeds=Array.from(root.querySelectorAll('iframe,embed,object')).map(el=>({tag:el.tagName.toLowerCase(),id:el.getAttribute('id'),src:redact(el.getAttribute('src')||el.getAttribute('data')||'').slice(0,3000)}));
 const scriptReferences=[...new Set(Array.from(root.querySelectorAll('script')).flatMap(script=>(script.textContent||'').match(/(?:https?:\/\/[^\s"'<>]+)?\/storage\/[^\s"'<>]+/g)||[]))].map(redact).slice(0,30);
 root.querySelectorAll('script,style,meta,link,header,nav,footer,input,textarea,select').forEach(n=>n.remove());
 for(const el of root.querySelectorAll('*'))for(const name of el.getAttributeNames()){
   if(!['class','id','href','src','data','title','colspan','rowspan'].includes(name))el.removeAttribute(name);
   else if(['href','src','data'].includes(name)){const path=safePath(el.getAttribute(name)||'',origin);if(path)el.setAttribute(name,path);else el.removeAttribute(name);}
 }
 const content=root.querySelector('main')||root.body||root;
 const markup=content.outerHTML||content.toString();
 return {html:markup.slice(0,180000),truncated:markup.length>180000,embeds,scriptReferences};
}
