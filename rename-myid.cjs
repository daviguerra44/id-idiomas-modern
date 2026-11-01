const fs=require('fs');
for(const file of ['public/dashboard.js','public/integrated.js','app/layout.tsx','app/api/myedi/data/route.ts','README.md','test-dashboard-ui.cjs']){const s=fs.readFileSync(file,'utf8');fs.writeFileSync(file,s.replaceAll('MyEDI','MyID'));}
let html=fs.readFileSync('site/index.html','utf8');html=html.replaceAll('My ID','MyID').replaceAll('MY ID','MYID').replaceAll('MyEDI','MyID').replaceAll('dashboard.js?v=8','dashboard.js?v=9').replaceAll('integrated.js?v=8','integrated.js?v=9');fs.writeFileSync('site/index.html',html);
console.log('MyID branding updated; database keys and API routes preserved.');
