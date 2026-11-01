import {parseHTML} from 'linkedom';
export function publishedMyIDLinks(html){
 const {document}=parseHTML(html),urls=[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
 for(const match of html.matchAll(/\bet_link_options_data\s*=\s*(\[[\s\S]*?\]);/g)){
  try{const entries=JSON.parse(match[1]);if(Array.isArray(entries))urls.push(...entries.map(item=>item.url));}catch{/* Do not evaluate page scripts. */}
 }
 const result=new Set();for(const value of urls){if(typeof value!=='string')continue;try{const url=new URL(value,'https://id-idiomas.com.br/');if(url.hostname==='my.id-idiomas.com.br'&&!url.username&&!url.password)result.add(url.href);}catch{}}
 return [...result];
}
