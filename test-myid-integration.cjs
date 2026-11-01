const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{webcrypto}=require('node:crypto');
const root=process.cwd(),cache=new Map();let env={},transport;
function load(file){
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file);
 const output={};cache.set(file,output);
 const localRequire=name=>{if(name==='cloudflare:workers')return {env};if(name.startsWith('.')){const target=path.resolve(path.dirname(file),name);if(target.endsWith('.json'))return require(target);return load(target+'.ts');}return require(name)};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports:output,require:localRequire,Response,Request,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,AbortSignal,atob,btoa,structuredClone,fetch:(...args)=>transport(...args),console},{filename:file});return output;
}
const protocol=load('app/legacy/protocol.ts'),vault=load('app/legacy/vault.ts'),origin='https://my.id-idiomas.com.br';
const form='<form method="post" action="/login/authenticate"><input name="username"><input name="password" type="password"><input name="csrf" type="hidden" value="test-csrf"></form>';
const profile='<h1>Aluno Teste</h1><a href="/perfil/show/abcdef1234">Perfil</a><article class="card"><h3>Advanced 2</h3><table><tr><td>Matrícula</td><td>2026.2.08779</td></tr><tr><td>Nível</td><td>Advanced 2</td></tr><tr><td>Professor</td><td>Professora Teste</td></tr><tr><td>Situação da Matrícula</td><td>Ativa</td></tr></table><a href="/perfil/curso/8779">Curso</a><a href="/perfil/reportCardMatricula/8779">Report Card</a><a href="/perfil/evaluationMatricula/8779">Evaluation</a><a href="/matricula/boletoPrint/8779">Boletos</a><a href="/matricula/contratoPrint/8779">Contrato</a></article>';
const report='<article class="card"><h3>Report Card 1</h3><table><tr><td>Avaliação Diária</td><td>8.2</td></tr><tr><td>Dever de Casa</td><td>0</td></tr><tr><td>Grade</td><td>7.24</td></tr></table><p>Comentários: Continue praticando.</p><a href="/reportCard/print/17407?u=0">IMPRIMIR</a></article><article class="card"><h3>Report Card 2</h3><p>Ainda não disponível</p></article>';
const course='<a href="/perfil/aula/8779?aula=abcdef123456">Class Preview</a><a href="/perfil/aula/8779?aula=abcdef123457">Unit 1 · Class 1</a><a href="/perfil/aula/9999?aula=abcdef123458">Other</a>';
const pdfPath='/storage/uploads/Anexo/abcdef/file.pdf';
const lesson='<iframe src="'+pdfPath+'"></iframe><script>neverExecute()</script><a href="https://other.test/x.pdf">External</a>';
const html=(text,options={})=>new Response(text,{...options,headers:{'content-type':'text/html; charset=utf-8',...options.headers}});
(async()=>{
 assert.equal(protocol.safePath('https://evil.test/perfil/curso/8779',origin),null);
 for(const target of ['/perfil/edit/abc','/matricula/revisarContrato/8779','/storage/uploads/Anexo/id/%2e%2e','/perfil/aula/8779?aula=abcdef1234&url=evil','/perfil/curso/8779?x=1'])assert.equal(protocol.safePath(target,origin),null,target);
 assert.equal(protocol.safePath('/perfil/curso/8779',origin),'/perfil/curso/8779');
 const parsed=protocol.parseProfile(profile,origin);assert.equal(parsed.enrollments.length,1);assert.equal(parsed.enrollments[0].registration,'2026.2.08779');assert.equal(parsed.enrollments[0].teacher,'Professora Teste');
 const reports=protocol.parseReports(report,origin);assert.equal(reports[0].officialGrade,7.24);assert.equal(reports[0].scores[1].value,0);assert.equal(reports[1].available,false);assert(reports[0].comment.includes('Continue praticando'));assert.equal(reports[0].printPath,'/reportCard/print/17407?u=0');
 assert.throws(()=>protocol.loginForm(form.replace('<form ','<form enctype="application/json" '),origin),e=>e.code==='LOGIN_ENCODING');
 assert.equal(protocol.loginForm(form.replace('</form>','<input name="csrf" type="hidden" value="second"></form>'),origin).getAll('csrf').length,2);
 assert(protocol.loginForm(fs.readFileSync('tests/fixtures/myid-login-public.html','utf8'),origin) instanceof URLSearchParams,'Captured public form must match the implemented field contract');
 assert.throws(()=>protocol.parseReports('<h1>Not a report</h1>'),/blocos/);
 assert.equal(protocol.parseLessons(course,origin,'8779').length,2);assert.equal(protocol.parseFiles(lesson,origin).length,1);
 assert.equal(protocol.parseReadOnlyDocument('<iframe src="'+pdfPath+'"></iframe>',origin).files.length,1,'A viewer-only document must still expose its authorized PDF');
 assert.throws(()=>protocol.parseProfile(form,origin),/sessão/);
 let requests=[];
 transport=async(url,options)=>{requests.push({url,...options});if(url===origin+'/')return html(form,{headers:{'set-cookie':'JSESSIONID=before; Path=/; HttpOnly'}});if(url.endsWith('/login/authenticate')){assert(options.headers.Cookie.includes('before'));const body=new URLSearchParams(options.body);assert.equal(body.get('username'),'test-user');assert.equal(body.get('password'),'test-password');assert.equal(body.get('csrf'),'test-csrf');return new Response(null,{status:302,headers:{location:'/perfil', 'set-cookie':'JSESSIONID=after; Path=/; HttpOnly'}})}if(url.endsWith('/perfil')||url.includes('/perfil/show/'))return html(profile);throw Error('Unexpected fixture request');};
 const client=new protocol.LegacyClient(origin);assert.equal((await client.login('test-user','test-password')).enrollments.length,1);assert.equal(client.jar.JSESSIONID,'after');assert(requests.filter(r=>r.method==='POST').length===1);
 let homeRead=false;transport=async(url)=>{if(url===origin+'/')return html(form);if(url.endsWith('/login/authenticate'))return html('<h1>Bem-vindo</h1>',{headers:{'set-cookie':'JSESSIONID=home-test'}});if(url.endsWith('/perfil/home')){homeRead=true;return html(profile)}if(url.includes('/perfil/show/'))return html(profile);throw Error('Unexpected home fixture request')};assert.equal((await new protocol.LegacyClient(origin).login('x','y')).enrollments.length,1);assert(homeRead);
 transport=async(url)=>url===origin+'/'?html(form):new Response(null,{status:302,headers:{location:'/login/auth?login_error=1'}});await assert.rejects(()=>new protocol.LegacyClient(origin).login('x','y'),e=>e.code==='LOGIN_FAILED'&&e.status===401);
 transport=async()=>new Response(null,{status:302,headers:{location:'https://evil.test/steal'}});await assert.rejects(()=>client.html('/perfil'),/fora da integração/);
 transport=async()=>html(form,{headers:{'set-cookie':'JSESSIONID=anonymous'}});await assert.rejects(()=>new protocol.LegacyClient(origin).login('x','y'),/não reconhecidos/);
 transport=async()=>new Response(null,{status:302,headers:{location:'/login/auth'}});await assert.rejects(()=>client.html('/perfil'),/expirou/);
 await assert.rejects(()=>new protocol.LegacyClient(origin,{},async()=>{throw new Error('sensitive transport text')}).html('/perfil'),/Não foi possível conectar/);
 assert.throws(()=>new protocol.LegacyClient('http://my.id-idiomas.com.br'),/HTTPS/);
 await assert.rejects(()=>protocol.boundedBody(new Response('123456'),5),/limite/);
 const secret=Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'),sealed=await vault.seal({cookie:'test-session'},secret,'owner');assert(!sealed.includes('test-session'));assert.equal((await vault.unseal(sealed,secret,'owner')).cookie,'test-session');await assert.rejects(()=>vault.unseal(sealed,secret,'other'),/novamente/);

 // End-to-end fixture import. All upstream requests are intercepted by transport.
 let academic={document:fs.readFileSync('site/seed.json','utf8'),revision:0},sessionRow=null,files=new Map(),fileFetches=0;
 env.DB={prepare(sql){return {args:[],bind(...args){this.args=args;return this},async first(){if(sql.includes('FROM myid_legacy_session'))return sessionRow&&{...sessionRow};if(sql.includes('FROM myedi_state'))return {...academic};throw Error(sql)},async run(){const a=this.args;let changes=1;
 if(sql.startsWith('INSERT OR IGNORE INTO myid_legacy_session')){sessionRow??={sealed:'',expires_at:0,locked_until:0,failures:0,retry_at:0};}
 else if(sql.startsWith('UPDATE myid_legacy_session SET locked_until=?')){if(sessionRow.locked_until>=a[2])changes=0;else sessionRow.locked_until=a[0];}
 else if(sql.includes('SET locked_until=0'))sessionRow.locked_until=0;
 else if(sql.includes('SET sealed=?,expires_at=?'))Object.assign(sessionRow,{sealed:a[0],expires_at:a[1],failures:0,retry_at:0});
 else if(sql.includes('SET sealed=?,updated_at=?'))sessionRow.sealed=a[0];
 else if(sql.includes("SET sealed=''"))Object.assign(sessionRow,{sealed:'',expires_at:0,locked_until:0});
 else if(sql.includes('SET failures=failures+1')){sessionRow.failures++;sessionRow.retry_at=a[0];}
 else if(sql.startsWith('INSERT OR IGNORE INTO myedi_state')){}
 else if(sql.startsWith('UPDATE myedi_state SET document=')){if(academic.revision!==a[3])changes=0;else{academic.document=a[0];academic.revision++;}}
 else throw Error('Unknown fixture SQL '+sql);
 return {meta:{changes}};}}}};
 env.BUCKET={async put(key,value){files.set(key,value)}};env.MYID_SESSION_KEY=secret;env.MYID_ORIGIN=origin;env.MYID_CONNECTION_VERIFIED='true';
 transport=async(url,options)=>{if(url===origin+'/')return html(form,{headers:{'set-cookie':'JSESSIONID=test-only'}});if(url.endsWith('/login/authenticate'))return html(profile);if(url.endsWith('/perfil/show/abcdef1234'))return html(profile);if(url.endsWith('/perfil/curso/8779'))return html(course);if(url.includes('/perfil/aula/8779'))return html(lesson);if(url.endsWith('/reportCardMatricula/8779'))return html(report);if(url.endsWith('/evaluationMatricula/8779'))return html('<main><h1>Evaluation</h1><p>Feedback de teste.</p><a href="/storage/uploads/Anexo/eval/eval.pdf">Evaluation PDF</a></main>');if(url.endsWith('/matricula/contratoPrint/8779'))return html('<main><h1>Contrato</h1><p>Contrato de teste.</p><a href="/storage/uploads/Anexo/contract/contract.pdf">Contrato PDF</a></main>');if(url.endsWith('/matricula/boletoPrint/8779')||url.endsWith('/eval.pdf')||url.endsWith('/contract.pdf'))return new Response('%PDF-1.4 document fixture',{headers:{'content-type':'application/pdf'}});if(url.endsWith('/reportCard/print/17407?u=0'))return html('<main><h1>Report Card 1</h1><p>Grade 7.24</p><script>forbiddenScript()</script></main>');if(url.endsWith('/logout/index'))return new Response(null,{status:302,headers:{location:'/login/auth'}});if(url.endsWith(pdfPath)){fileFetches++;return new Response('%PDF-1.4 test fixture',{headers:{'content-type':'application/pdf'}})}throw Error('Unexpected fixture URL '+url)};
 const sync=load('app/legacy/sync.ts');await sync.connect('owner','test-user','test-password');assert(!sessionRow.sealed.includes('test-only'));let progress=await sync.start('owner');let iterations=0;while(progress.pending&&iterations++<20)progress=await sync.step('owner');assert.equal(progress.pending,0);assert.equal(progress.imported,5);assert.equal(files.size,4);assert.equal(fileFetches,2);
 const state=JSON.parse(academic.document),c=state.courses.find(c=>c.legacyEnrollmentId==='8779'),lessons=state.lessons.filter(l=>l.courseId===c.id);assert.equal(c.officialGrade,7.24);assert.equal(c.reportCards.length,2);assert.equal(lessons.length,2);assert(lessons.every(l=>l.materialIds.length===1));assert.notEqual(lessons[0].materialIds[0],lessons[1].materialIds[0]);assert.equal(c.documents.evaluation.blocks[1].text,'Feedback de teste.');
 for(const l of lessons){const m=state.materials.find(m=>m.id===l.materialIds[0]);assert.equal(m.lessonId,l.id);assert(m.url.startsWith('/api/myedi/files/'));}
 assert.equal(c.documents.evaluation.materialIds.length,1);assert.equal(c.documents.boleto.materialIds.length,1);assert.equal(c.documents.contract.materialIds.length,1);assert.equal(c.documents['report-print-1'].blocks[1].text,'Grade 7.24');assert(!JSON.stringify(c.documents).includes('forbiddenScript'));assert(!c.reportCards[0].printPath);assert(!JSON.stringify(await sync.status('owner')).includes('test-only'));
 progress=await sync.start('owner');iterations=0;while(progress.pending&&iterations++<20)progress=await sync.step('owner');assert.equal(JSON.parse(academic.document).lessons.length,2,'Repeated imports must not duplicate lessons');
 assert.equal((await sync.disconnect('owner')).remoteLogout,'requested');assert.equal(sessionRow.sealed,'');
 const normalTransport=transport;transport=async(url,options)=>url.endsWith('/logout/index')?new Response(null,{status:503}):normalTransport(url,options);await sync.connect('owner','test-user','test-password');assert.equal((await sync.disconnect('owner')).remoteLogout,'unconfirmed');assert.equal(sessionRow.sealed,'','Local session must be cleared even when remote logout fails');
 env.MYID_CONNECTION_VERIFIED=undefined;assert.equal(sync.connectionStatus().configured,false);
 console.log('Integration fixtures passed: form encoding/CSRF, failed login redirect, authenticated home/profile discovery, report/print/Evaluation/contract/boleto, course PDFs, idempotence, encrypted sessions and remote logout with local cleanup on failure. No live upstream requests made.');
})().catch(e=>{console.error(e);process.exitCode=1});
