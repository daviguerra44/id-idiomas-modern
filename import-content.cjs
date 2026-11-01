const fs=require('fs');
const read=n=>JSON.parse(fs.readFileSync('source-import/'+n,'utf8').replace(/^\uFEFF/,''));
const pages=read('pages.json');
function decode(s){return s.replace(/&#(x[\da-f]+|\d+);/gi,(_,v)=>String.fromCodePoint(v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):+v)).replace(/&(?:amp|nbsp|quot|apos|lt|gt);/g,v=>({'&amp;':'&','&nbsp;':' ','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[v]));}
function text(s){return decode(s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/\[\/?et_pb_[^\]]*\]/g,'').replace(/<[^>]*>/g,' ').replace(/[\uE000-\uF8FF]/g,'')).replace(/\s+/g,' ').trim()}
function parseBlocks(source){const out=[];let type='p',buffer='',skip=false;const flush=()=>{const value=text(buffer);if(value&&value!=='%'&&value!=='Z'&&!/^(de satisfação|de aprovação|alunos no Brasil|estudantes com scores)/.test(value))out.push({type,text:value});buffer=''};const clean=source.replace(/\[\/?et_pb_[^\]]*\]/g,'');for(const token of clean.match(/<[^>]*>|[^<]+/g)||[]){if(token[0]!=='<'){if(!skip)buffer+=token;continue}if(/^<script\b/i.test(token)){skip=true;continue}if(/^<\/script/i.test(token)){skip=false;continue}if(skip)continue;const m=token.match(/^<(\/?)([a-z\d]+)/i);if(!m)continue;const closing=m[1],tag=m[2].toLowerCase();if(tag==='br'){buffer+=' ';continue}if(['p','li','div','section','ul','ol','h1','h2','h3','h4','h5','h6'].includes(tag)){flush();type=!closing&&(tag.startsWith('h')||tag==='li')?tag:'p'}}flush();return out.filter((b,i)=>i===0||out[i-1].text!==b.text)}
const data={};
const videos=new Set();
for(const p of pages){const s=p.content.rendered;const blocks=parseBlocks(s);
const v=[...new Set([...s.matchAll(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/g)].map(m=>m[1]))];v.forEach(x=>videos.add(x));
data[p.slug]={title:text(p.title.rendered),blocks,videos:v};}
const rawPosts=read('posts.json');const posts=Array.isArray(rawPosts)?rawPosts:[rawPosts];data.posts=posts.filter(p=>p.slug!=='ola-mundo').map(p=>({slug:p.slug,title:text(p.title.rendered),blocks:[...p.content.rendered.matchAll(/<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(m=>({type:m[1],text:text(m[2])}))}));
fs.writeFileSync('dist/content.js','window.ID_CONTENT='+JSON.stringify(data)+';\n');
fs.writeFileSync('source-import/video-ids.json',JSON.stringify([...videos]));
console.log('Imported',pages.length,'pages,',videos.size,'videos,',data.posts.length,'editorial posts.');
for(let i=1;i<=4;i++){const f='dist/materials/ebook-'+i+'.pdf';if(fs.existsSync(f)){const b=fs.readFileSync(f);console.log(f,b.subarray(0,5).toString(),b.length);}}
