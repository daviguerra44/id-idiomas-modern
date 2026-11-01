const fs=require('fs');
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace('</head>','<link rel="stylesheet" href="contrast.css?v=5"></head>');
fs.writeFileSync('dist/index.html',html);
const rgb=h=>h.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
const luminance=h=>rgb(h).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
for(const [label,fg,bg] of [['Texto principal','#25121a','#fffafb'],['Texto secundário','#59404c','#f3dbe5'],['Botão carmesim','#ffffff','#a70b36'],['Legenda','#633247','#efdae5'],['Indicadores','#9d082f','#f1dce7'],['Campo de leitura','#633247','#f0e3eb']]){const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(ratio<4.5)throw Error(label+' insufficient contrast');console.log(label+': '+ratio.toFixed(2)+':1')}
