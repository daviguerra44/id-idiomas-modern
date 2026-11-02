// Verifies parsers against supplied authenticated HTML captures, never fixtures
// generated here. Capture files stay local; this script does not perform login.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),{parseHTML}=require('linkedom');
const [profileFile,courseFile,enrollmentId,lessonFile,captureOrigin]=process.argv.slice(2);
if(!profileFile||!courseFile||!enrollmentId)throw Error('Use: node scripts/check-myid-observed.cjs perfil.html curso.html matriculaId [aula.html]');
const protocol={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/legacy/protocol.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:protocol,require,URL,URLSearchParams});
const origin=captureOrigin||'http://capture.local',profileHTML=fs.readFileSync(profileFile,'utf8'),courseHTML=fs.readFileSync(courseFile,'utf8');
const profile=protocol.parseProfile(profileHTML,origin),lessons=protocol.parseLessons(courseHTML,origin,enrollmentId);
const cards=[...parseHTML(profileHTML).document.querySelectorAll('.mdl-card')].filter(card=>card.textContent.includes('Matrícula')&&card.querySelector('a[href*="Matricula/"],a[href*="boletoPrint/"]'));
assert.equal(profile.enrollments.length,cards.length,'One independent record per enrollment card');
for(const e of profile.enrollments){assert(e.title&&e.registration&&e.level&&e.teacher&&e.status,'Missing observed enrollment field');if(e.schedule){assert(e.title.includes(e.schedule.raw));assert(!e.schedule.endTime);}else assert(!/\(\d{1,2}:\d{2}\)/.test(e.title));}
const links=[...parseHTML(courseHTML).document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>h.startsWith('/perfil/aula/'+enrollmentId+'?'));
assert.equal(lessons.length,new Set(links).size,'Every distinct lesson link must be retained');
assert(lessons.every(l=>l.title&&!/Visualizar/.test(l.title)));
let pdfs;if(lessonFile){pdfs=protocol.parseFiles(fs.readFileSync(lessonFile,'utf8'),origin);assert(pdfs.length,'No attachment found in the observed lesson');}
console.log(JSON.stringify({source:'authenticated HTML captures',enrollments:profile.enrollments.length,completeFields:profile.enrollments.filter(e=>e.title&&e.registration&&e.level&&e.teacher&&e.status).length,schedules:profile.enrollments.filter(e=>e.schedule).length,distinctLessons:lessons.length,observedPDFs:pdfs?.length}));
