const fs=require('fs');let js=fs.readFileSync('public/dashboard.js','utf8');
const start=js.indexOf('const quote=',js.indexOf('function exportGrades(')),end=js.indexOf('const rows=',start);
js=js.slice(0,start)+`const quote=v=>{let text=String(v??'');if(/^[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};`+js.slice(end);
fs.writeFileSync('public/dashboard.js',js);
