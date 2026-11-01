const fs=require('fs');
const file='dist/index.html';
let html=fs.readFileSync(file,'utf8');
html=html.replaceAll('<span class="brandmark">iD</span><span>IDIOMAS<small>CONEXÕES PARA A VIDA</small></span>','<img class="original-logo" src="assets/logo.png" alt="ID Idiomas">');
html=html.replace('https://www.youtube.com/results?search_query=ID+Idiomas+alunos','https://www.youtube.com/channel/UCs1XUQzBrCbcIWfMOVf5Pwg');
fs.writeFileSync(file,html);
console.log('Original logos:',(html.match(/original-logo/g)||[]).length);
