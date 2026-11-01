const fs=require('fs');
let js=fs.readFileSync('dist/app.js','utf8');
const books=[['Inglês nas férias','Inglês nas férias: como manter a prática?','','ebook1-como-manter-a-pratica-do-ingles-durante-as-ferias/',''],['Prática & evolução','7 estratégias para acelerar seu inglês.','','ebook2-7-estrategias-que-vao-acelerar-o-seu-ingles/',''],['Inglês & carreira','Entrevista de emprego: por onde começar?','','ebook4-entrevista-de-emprego-como-responder-tell-me-about-you/',''],['Aprendizado','Como falar inglês: o segredo.','','ebook3-o-segredo-de-falar-ingles/','']];
js=js.replace(/const books=\[[^\n]+;/,'const books='+JSON.stringify(books)+';');
fs.writeFileSync('dist/app.js',js);
let readme=fs.readFileSync('README.md','utf8');
readme=readme.replace('- A foto de estudantes é ilustrativa, fornecida pelo Unsplash. Logomarca e vídeo são do site oficial.','- O redesign usa as imagens originais das teachers, metodologia e cursos, capas originais de quatro e-books e miniaturas dos vídeos da escola.\n- Interface clara com carmesim, painéis de vidro, cantos arredondados e movimento discreto, respeitando a preferência de redução de movimento.');
fs.writeFileSync('README.md',readme);
console.log('Four original e-books mapped to their official pages.');
