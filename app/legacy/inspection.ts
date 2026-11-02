import {parseHTML} from 'linkedom';
import {safePath} from './protocol';

// Authenticated, account-scoped HTML evidence. Never execute or expose scripts,
// hidden controls, credentials or arbitrary destinations.
export function inspectAcademicHTML(html:string,origin:string){
 const root=parseHTML(html).document;
 root.querySelectorAll('script,style,meta,link,header,nav,footer,input,textarea,select').forEach(n=>n.remove());
 for(const el of root.querySelectorAll('*'))for(const name of el.getAttributeNames()){
   if(!['class','id','href','src','data','title','colspan','rowspan'].includes(name))el.removeAttribute(name);
   else if(['href','src','data'].includes(name)){const path=safePath(el.getAttribute(name)||'',origin);if(path)el.setAttribute(name,path);else el.removeAttribute(name);}
 }
 const content=root.querySelector('main')||root.body||root;
 const markup=content.outerHTML||content.toString();
 return {html:markup.slice(0,180000),truncated:markup.length>180000};
}
