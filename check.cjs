const fs=require('fs');
const html=fs.readFileSync('dist/index.html','utf8');
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
const missing=[...html.matchAll(/href="#([^"]+)"/g)].map(x=>x[1]).filter(x=>!ids.includes(x));
if(missing.length||!html.includes('conversação')||ids.some((x,i)=>ids.indexOf(x)!==i))throw Error('HTML validation failed');
console.log('Anchors, unique IDs and UTF-8 passed.');
Promise.all(['','style.css','app.js','assets/logo.png','assets/students.jpg'].map(async p=>{const r=await fetch('http://127.0.0.1:4173/'+p);if(!r.ok)throw Error(p+': '+r.status);console.log(p||'index.html',r.status)})).catch(e=>{console.error(e);process.exitCode=1});
