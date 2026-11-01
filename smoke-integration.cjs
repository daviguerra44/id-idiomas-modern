const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {parseHTML}=require('../id-validation/node_modules/linkedom');
const {document,Event}=parseHTML(fs.readFileSync('dist/index.html','utf8'));
const storage=new Map();let printed=0;
for(const d of document.querySelectorAll('dialog')){d.showModal=()=>d.setAttribute('open','');d.close=()=>d.removeAttribute('open')}
class TestFormData{constructor(form){this.form=form}get(name){return this.form.querySelector('[name="'+name+'"]').value}}
const location={hash:''},window={addEventListener(){},scrollTo(){},print(){printed++},open(){}};
const ctx=vm.createContext({document,window,location,URL,URLSearchParams,Blob,FormData:TestFormData,FileReader:class{},console,setTimeout(){return 1},clearTimeout(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
vm.runInContext(fs.readFileSync('dist/content.js','utf8'),ctx);vm.runInContext(fs.readFileSync('dist/integrated.js','utf8'),ctx);
const routes=new Set(['cursos','quem-somos','metodologia','id-connector','e-books','star-event','star-event/2025-1','star-event/arquivo','videos','blog','contato','my-id','my-id/perfil','my-id/materiais','my-id/cursos']);
const tested=new Set();let assets=0;
function inspect(){for(const a of document.querySelectorAll('a[href]')){const href=a.getAttribute('href');assert(!/^https?:\/\/(?:my\.)?id-idiomas\.com\.br/i.test(href),'Original destination '+href);if(href.startsWith('#/'))routes.add(href.slice(2))}
for(const el of document.querySelectorAll('img[src],link[rel=stylesheet],object[data]')){const src=el.getAttribute('src')||el.getAttribute('href')||el.getAttribute('data');if(/^(?:https?:|data:)/.test(src))continue;assert(fs.existsSync(path.join('dist',src.split('?')[0])),'Missing asset '+src);assets++}}
inspect();
for(const r of routes){if(tested.has(r))continue;tested.add(r);location.hash='#/'+r;ctx.route();if(!r.startsWith('my-id'))assert(!document.querySelector('#site-page .breadcrumbs').textContent.includes('Página não encontrada'),'Route missing '+r);inspect()}
assert(tested.size>45,'Too few internal routes');
location.hash='#/my-id/boletim/turma';ctx.route();assert.equal(document.querySelectorAll('.score-row').length,6);assert(document.querySelector('.grade-total').textContent.includes('7,24'));assert(document.querySelector('.teacher-comment').textContent.includes('Clara')===false);assert(document.querySelector('.report-teacher').textContent.includes('Clara Carvalho Monteiro'));
document.querySelector('[data-print]').dispatchEvent(new Event('click',{bubbles:true}));assert.equal(printed,1);
location.hash='#/my-id/perfil';ctx.route();const form=document.querySelector('#profile-form');form.querySelector('[name=name]').value='Perfil Teste';form.querySelector('[name=email]').value='teste@example.com';form.querySelector('[name=phone]').value='';form.onsubmit({preventDefault(){},target:form});assert.equal(JSON.parse(storage.get('id-profile-v3')).name,'Perfil Teste');assert(document.querySelector('.student-mini').textContent.includes('Perfil Teste'));
ctx.renderCourses('espanhol');assert.equal(document.querySelectorAll('#course-grid .course-card').length,1);ctx.renderCourses('empresas');assert.equal(document.querySelectorAll('#course-grid .course-card').length,1);
ctx.openVideo('hmkMTl29l2U');assert(document.querySelector('#video-frame iframe').getAttribute('src').startsWith('https://www.youtube-nocookie.com/embed/'));assert(document.querySelector('#video-dialog').hasAttribute('open'));
for(let i=1;i<=4;i++){const b=fs.readFileSync('dist/materials/ebook-'+i+'.pdf');assert.equal(b.subarray(0,5).toString(),'%PDF-')}
console.log(JSON.stringify({routes:tested.size,assetReferencesChecked:assets,courseFilters:'passed',profilePersistence:'passed',reportCardAndPrint:'passed',videoEmbed:'passed',fourPdfFiles:'passed',originalSiteLinks:0}));
