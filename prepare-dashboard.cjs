const fs=require('fs'),path=require('path');
const starter=path.resolve('../id-fullstack-starter');
for(const name of fs.readdirSync(starter)){if(['.openai','.gitignore','README.md','.sites-runtime','app'].includes(name))continue;fs.cpSync(path.join(starter,name),name,{recursive:true})}
fs.mkdirSync('app',{recursive:true});for(const name of fs.readdirSync(path.join(starter,'app'))){if(name==='page.tsx')continue;fs.cpSync(path.join(starter,'app',name),path.join('app',name),{recursive:true})}
fs.cpSync('dist','public',{recursive:true});fs.mkdirSync('site',{recursive:true});fs.copyFileSync('dist/index.html','site/index.html');fs.unlinkSync('public/index.html');
let ignore=fs.readFileSync('.gitignore','utf8');ignore+='\n'+fs.readFileSync(path.join(starter,'.gitignore'),'utf8');fs.writeFileSync('.gitignore',ignore);
const config=JSON.parse(fs.readFileSync('.openai/hosting.json','utf8'));delete config.static;config.d1='DB';config.r2='BUCKET';fs.writeFileSync('.openai/hosting.json',JSON.stringify(config,null,2)+'\n');
console.log('Prepared full-stack project; previous static output preserved until build.');
