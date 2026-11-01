const fs=require('fs');
const path=require('path');
let html=fs.readFileSync('dist/index.html','utf8');
if(!html.includes('href="redesign.css')){html=html.replace('</head>','<link rel="stylesheet" href="redesign.css?v=2"></head>');fs.writeFileSync('dist/index.html',html)}
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
const anchors=[...html.matchAll(/href="#([^"]+)"/g)].map(x=>x[1]);
const assets=[...html.matchAll(/(?:src|href)="((?:assets\/|[^/"#]+\.css)[^"]*)"/g)].map(x=>x[1].split('?')[0]);
for(const a of assets)if(!fs.existsSync(path.join('dist',a)))throw Error('Missing asset: '+a);
if(anchors.some(a=>!a.startsWith('/')&&!ids.includes(a)))throw Error('Missing anchor');
if(ids.some((x,i)=>ids.indexOf(x)!==i))throw Error('Duplicate ID');
if(!html.includes('Conversação'))throw Error('Encoding');
console.log('Validated: '+assets.length+' image/style references, anchors, unique IDs, UTF-8.');
