const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{webcrypto}=require('node:crypto');
const root=process.cwd(),cache=new Map();let env={},transport,user=null;
function load(file){
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file);
 const output={};cache.set(file,output);
 const localRequire=name=>{if(name==='cloudflare:workers')return {env};if(name.endsWith('chatgpt-auth'))return {getChatGPTUser:async()=>user};if(name.startsWith('.')){const target=path.resolve(path.dirname(file),name);if(target.endsWith('.json'))return require(target);return load(target+'.ts');}return require(name)};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports:output,require:localRequire,Response,Request,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,FormData,File,crypto:webcrypto,AbortSignal,atob,btoa,structuredClone,fetch:(...args)=>transport(...args),console},{filename:file});return output;
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
 for(const target of ['/storage/uploads/Anexo/id/%2e%2e','/perfil/aula/8779?aula=abcdef1234&url=evil','/perfil/curso/8779?x=1'])assert.equal(protocol.safePath(target,origin),null,target);
 assert.equal(protocol.safePath('/perfil/curso/8779',origin),'/perfil/curso/8779');assert.equal(protocol.safePath('/reportCard/print/1?u=1',origin),'/reportCard/print/1?u=1');assert.equal(protocol.safePath('/perfil/edit/abc',origin),'/perfil/edit/abc');assert.equal(protocol.safePath('/matricula/revisarContrato/8779',origin),'/matricula/revisarContrato/8779');const fields=protocol.parseProfileFields('<form><label for="email">E-mail</label><input id="email" name="email" value="test@example.test"><input type="password" name="password" value="secret"><input type="hidden" name="csrf" value="hidden"></form>');assert.equal(fields.length,1);assert.equal(fields[0].value,'test@example.test');assert.equal(protocol.findProfileEditPath('<a href="/perfil/edit/abc">Editar</a><a href="/perfil/edit/def">Outro</a>',origin,'/perfil/show/abc'),'/perfil/edit/abc');

 const photoFields=protocol.profilePhotoForm('<form action="/perfil/update" method="post" enctype="multipart/form-data"><input type="hidden" name="id" value="abcdef1234"><input type="hidden" name="version" value="2"><input type="file" name="imagemUpload"></form>',origin,'/perfil/show/abcdef1234');assert.equal(photoFields[1].name,'version');assert.equal(photoFields[1].value,'2');assert.throws(()=>protocol.profilePhotoForm('<form action="/perfil/update" method="post" enctype="multipart/form-data"><input type="hidden" name="id" value="other"><input type="file" name="imagemUpload"></form>',origin,'/perfil/show/abcdef1234'),e=>e.code==='PROFILE_FORBIDDEN');
 assert.equal(protocol.parseProfilePhoto('<style>.caixa-foto-perfil {background-image:url("/storage/uploads/Perfil/abc/photo.jpg")}</style><div class="caixa-foto-perfil"></div>',origin),'/storage/uploads/Perfil/abc/photo.jpg');

 const recovery=protocol.recoveryForm(fs.readFileSync('tests/fixtures/myid-recovery-public.html','utf8'),origin);assert(recovery instanceof URLSearchParams);assert.equal(recovery.size,0);
 const multipart=new FormData();multipart.append('id','abcdef1234');multipart.append('imagemUpload',new File([new Uint8Array([137,80,78,71])],'image.png',{type:'image/png'}));let photoRequest=false;
 await new protocol.LegacyClient(origin,{JSESSIONID:'photo-only'},async(url,options)=>{photoRequest=true;assert.equal(url,origin+'/perfil/update');assert(options.body instanceof Uint8Array,'Multipart must have a fixed-size byte body');assert.match(options.headers['Content-Type'],/^multipart\/form-data; boundary=/);assert.equal(options.headers['Content-Length'],undefined,'The runtime determines the length');assert.equal(options.body.at(-2),13);assert.equal(options.body.at(-1),10);const sent=await new Response(options.body,{headers:{'content-type':options.headers['Content-Type']}}).formData();assert.equal(sent.get('id'),'abcdef1234');assert.deepEqual(new Uint8Array(await sent.get('imagemUpload').arrayBuffer()),new Uint8Array([137,80,78,71]));assert.equal(options.headers.Cookie,'JSESSIONID=photo-only');return html(profile)}).html('/perfil/update',{method:'POST',body:multipart,photoUpdate:true,referer:'/perfil/edit/abcdef1234'});assert(photoRequest);
 const parsed=protocol.parseProfile(profile,origin);assert.equal(parsed.enrollments.length,1);assert.equal(parsed.enrollments[0].registration,'2026.2.08779');assert.equal(parsed.enrollments[0].teacher,'Professora Teste');
 const reports=protocol.parseReports(report,origin);assert.equal(reports[0].officialGrade,7.24);assert.equal(reports[0].scores[1].value,0);assert.equal(reports[1].available,false);assert(reports[0].comment.includes('Continue praticando'));assert.equal(reports[0].printPath,'/reportCard/print/17407?u=0');
 assert.throws(()=>protocol.loginForm(form.replace('<form ','<form enctype="application/json" '),origin),e=>e.code==='LOGIN_ENCODING');
 assert.equal(protocol.loginForm(form.replace('</form>','<input name="csrf" type="hidden" value="second"></form>'),origin).getAll('csrf').length,2);
 assert(protocol.loginForm(fs.readFileSync('tests/fixtures/myid-login-public.html','utf8'),origin) instanceof URLSearchParams,'Captured public form must match the implemented field contract');
 const observed=protocol.inspectLoginForm(fs.readFileSync('tests/fixtures/myid-login-public.html','utf8'),origin);assert.equal(observed.encoding,'application/x-www-form-urlencoded');assert.equal(observed.encodingExplicit,false);assert.equal(observed.hiddenFieldNames.length,0);assert.equal(observed.checkboxNames[0],'remember-me');assert.equal(observed.csrfMetadataNames.length,0);assert(!JSON.stringify(protocol.inspectLoginForm(form,origin)).includes('test-csrf'),'Inspection must expose names only, never token values');
 assert.throws(()=>protocol.parseReports('<h1>Not a report</h1>'),/blocos/);
 assert.equal(protocol.parseLessons(course,origin,'8779').length,2);assert.equal(protocol.parseFiles(lesson,origin).length,1);
 assert.equal(protocol.parseReadOnlyDocument('<iframe src="'+pdfPath+'"></iframe>',origin).files.length,1,'A viewer-only document must still expose its authorized PDF');
 assert.throws(()=>protocol.parseProfile(form,origin),/sessão/);
 let requests=[];
 transport=async(url,options)=>{requests.push({url,...options});if(url===origin+'/login/auth')return html(form,{headers:{'set-cookie':'JSESSIONID=before; Path=/; HttpOnly'}});if(url.endsWith('/login/authenticate')){assert(options.headers.Cookie.includes('before'));assert.equal(options.headers.Referer,origin+'/login/auth');assert.equal(options.headers['Content-Type'],'application/x-www-form-urlencoded');const body=new URLSearchParams(options.body);assert.equal(body.get('username'),'test-user');assert.equal(body.get('password'),'test-password');assert.equal(body.get('csrf'),'test-csrf');return new Response(null,{status:302,headers:{location:'/perfil', 'set-cookie':'JSESSIONID=after; Path=/; HttpOnly'}})}if(url.endsWith('/perfil')||url.includes('/perfil/show/'))return html(profile);throw Error('Unexpected fixture request');};
 const client=new protocol.LegacyClient(origin);assert.equal((await client.login('test-user','test-password')).enrollments.length,1);assert.equal(client.jar.JSESSIONID,'after');assert(requests.filter(r=>r.method==='POST').length===1);
 let homeRead=false;transport=async(url)=>{if(url===origin+'/login/auth')return html(form);if(url.endsWith('/login/authenticate'))return html('<h1>Bem-vindo</h1>',{headers:{'set-cookie':'JSESSIONID=home-test'}});if(url.endsWith('/perfil/home')){homeRead=true;return html(profile)}if(url.includes('/perfil/show/'))return html(profile);throw Error('Unexpected home fixture request')};assert.equal((await new protocol.LegacyClient(origin).login('x','y')).enrollments.length,1);assert(homeRead);
 transport=async(url)=>url===origin+'/login/auth'?html(form):new Response(null,{status:302,headers:{location:'/login/auth?login_error=1'}});await assert.rejects(()=>new protocol.LegacyClient(origin).login('x','y'),e=>e.code==='LOGIN_FAILED'&&e.status===401);
 transport=async()=>new Response(null,{status:302,headers:{location:'https://evil.test/steal'}});await assert.rejects(()=>client.html('/perfil'),/fora da integração/);
 transport=async()=>html(form,{headers:{'set-cookie':'JSESSIONID=anonymous'}});await assert.rejects(()=>new protocol.LegacyClient(origin).login('x','y'),/não reconhecidos/);
 transport=async()=>new Response(null,{status:302,headers:{location:'/login/auth'}});await assert.rejects(()=>client.html('/perfil'),/expirou/);
 await assert.rejects(()=>new protocol.LegacyClient(origin,{},async()=>{throw new Error('sensitive transport text')}).html('/perfil'),/Não foi possível conectar/);
 assert.throws(()=>new protocol.LegacyClient('http://my.id-idiomas.com.br'),/HTTPS/);
 await assert.rejects(()=>protocol.boundedBody(new Response('123456'),5),/limite/);

 // A configured HTTPS relay transports even absolute HTTP links safely as paths.
 const relay='https://protected.example.test',logical='http://my.id-idiomas.com.br',seen=[];
 const secureClient=new protocol.LegacyClient(logical,{JSESSIONID:'isolated-relay'},async(url,opts)=>{seen.push({url,opts});assert(url.startsWith(relay+'/'));assert.equal(opts.headers.Cookie,'JSESSIONID=isolated-relay');if(url.endsWith('/perfil'))return new Response(null,{status:302,headers:{location:logical+'/perfil/show/abcdef1234'}});return html(profile);},relay);
 assert((await secureClient.html('/perfil')).includes('Aluno Teste'));assert.equal(seen.length,2);assert.equal(protocol.safePath(logical+'/perfil/curso/8779',logical),'/perfil/curso/8779');assert.equal(protocol.loginForm(form.replace('action="/login/authenticate"','action="'+logical+'/login/authenticate"'),logical).get('csrf'),'test-csrf');assert.throws(()=>new protocol.LegacyClient(logical,{},transport,'http://relay.test'),/HTTPS/);
 const secret=Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'),sealed=await vault.seal({cookie:'test-session'},secret,'owner');assert(!sealed.includes('test-session'));assert.equal((await vault.unseal(sealed,secret,'owner')).cookie,'test-session');await assert.rejects(()=>vault.unseal(sealed,secret,'other'),/novamente/);

 // End-to-end fixture import. All upstream requests are intercepted by transport.
 const academics=new Map(),sessions=new Map();let files=new Map(),fileFetches=0;
 env.DB={prepare(sql){return {args:[],bind(...args){this.args=args;return this},async first(){if(sql.includes('FROM myid_legacy_session'))return sessions.has(this.args[0])?{...sessions.get(this.args[0])}:null;if(sql.includes('FROM myedi_state'))return academics.has(this.args[0])?{...academics.get(this.args[0])}:null;throw Error(sql)},async run(){const a=this.args;let changes=1;const sessionOwner=sql.includes('SET sealed=?,expires_at=?')?a[3]:sql.includes('SET sealed=?,updated_at=?')?a[2]:sql.includes("SET sealed=''")?a[1]:sql.includes('SET locked_until=?')?a[1]:sql.includes('SET failures=')?a[1]:a[0];let sessionRow=sessions.get(sessionOwner);let academic=academics.get(a[2]);
 if(sql.startsWith('INSERT OR IGNORE INTO myid_legacy_session')){if(!sessions.has(a[0]))sessions.set(a[0],{sealed:'',expires_at:0,locked_until:0,failures:0,retry_at:0});}
 else if(sql.startsWith('UPDATE myid_legacy_session SET locked_until=?')){if(sessionRow.locked_until>=a[2])changes=0;else sessionRow.locked_until=a[0];}
 else if(sql.includes('SET locked_until=0'))sessionRow.locked_until=0;
 else if(sql.includes('SET sealed=?,expires_at=?'))Object.assign(sessionRow,{sealed:a[0],expires_at:a[1],failures:0,retry_at:0});
 else if(sql.includes('SET sealed=?,updated_at=?'))sessionRow.sealed=a[0];
 else if(sql.includes("SET sealed=''"))Object.assign(sessionRow,{sealed:'',expires_at:0,locked_until:0});
 else if(sql.includes('SET failures=failures+1')){sessionRow.failures++;sessionRow.retry_at=a[0];}
 else if(sql.includes('SET expires_at=0'))sessionRow.expires_at=0;
 else if(sql.startsWith('INSERT OR IGNORE INTO myedi_state')){if(!academics.has(a[0]))academics.set(a[0],{document:a[1],revision:0});}
 else if(sql.startsWith('UPDATE myedi_state SET document=')){if(academic.revision!==a[3])changes=0;else{academic.document=a[0];academic.revision++;}}
 else throw Error('Unknown fixture SQL '+sql);
 return {meta:{changes}};}}}};
 env.BUCKET={async put(key,value,metadata){files.set(key,{body:value,...metadata})},async get(key){return files.get(key)},async head(key){return files.get(key)||null}};env.MYID_SESSION_KEY=secret;env.MYID_ORIGIN=origin;env.MYID_CONNECTION_VERIFIED='true';
 transport=async(url,options)=>{if(url===origin+'/login/auth')return html(form,{headers:{'set-cookie':'JSESSIONID=test-only'}});if(url.endsWith('/login/authenticate'))return html(profile);if(url.endsWith('/perfil/show/abcdef1234')||url.endsWith('/perfil/home'))return html(profile);if(url.endsWith('/perfil/curso/8779'))return html(course);if(url.includes('/perfil/aula/8779'))return html(lesson);if(url.endsWith('/reportCardMatricula/8779'))return html(report);if(url.endsWith('/evaluationMatricula/8779'))return html('<main><h1>Evaluation</h1><p>Feedback de teste.</p><a href="/storage/uploads/Anexo/eval/eval.pdf">Evaluation PDF</a></main>');if(url.endsWith('/matricula/contratoPrint/8779'))return html('<main><h1>Contrato</h1><p>Contrato de teste.</p><a href="/storage/uploads/Anexo/contract/contract.pdf">Contrato PDF</a></main>');if(url.endsWith('/matricula/boletoPrint/8779')||url.endsWith('/eval.pdf')||url.endsWith('/contract.pdf'))return new Response('%PDF-1.4 document fixture',{headers:{'content-type':'application/pdf'}});if(url.endsWith('/reportCard/print/17407?u=0'))return html('<main><h1>Report Card 1</h1><p>Grade 7.24</p><script>forbiddenScript()</script></main>');if(url.endsWith('/logout/index'))return new Response(null,{status:302,headers:{location:'/login/auth'}});if(url.endsWith(pdfPath)){fileFetches++;return new Response('%PDF-1.4 test fixture',{headers:{'content-type':'application/pdf'}})}throw Error('Unexpected fixture URL '+url)};
 const sync=load('app/legacy/sync.ts');await sync.connect('owner','test-user','test-password');assert(!sessions.get('owner').sealed.includes('test-only'));let progress=await sync.start('owner');let iterations=0;while(progress.pending&&iterations++<20)progress=await sync.step('owner');assert.equal(progress.pending,0);assert.equal(progress.imported,5);assert.equal(files.size,4);assert.equal(fileFetches,1);
 const accountA=(await sync.accountContext('owner')).accountKey;const state=JSON.parse(academics.get(accountA).document),c=state.courses.find(c=>c.legacyEnrollmentId==='8779'),lessons=state.lessons.filter(l=>l.courseId===c.id);assert.equal(c.officialGrade,7.24);assert.equal(c.reportCards.length,2);assert.equal(lessons.length,2);assert(lessons.every(l=>l.materialIds.length===1));assert.notEqual(lessons[0].materialIds[0],lessons[1].materialIds[0]);assert.equal(c.documents.evaluation.blocks[1].text,'Feedback de teste.');
 for(const l of lessons){const m=state.materials.find(m=>m.id===l.materialIds[0]);assert.equal(m.lessonId,l.id);assert(m.url.startsWith('/api/myedi/files/'));}
 assert.equal(c.documents.evaluation.materialIds.length,1);assert.equal(c.documents.boleto.materialIds.length,1);assert.equal(c.documents.contract.materialIds.length,1);assert.equal(c.documents['report-print-1'].blocks[1].text,'Grade 7.24');assert(!JSON.stringify(c.documents).includes('forbiddenScript'));assert(!c.reportCards[0].printPath);assert(!JSON.stringify(await sync.status('owner')).includes('test-only'));
 progress=await sync.start('owner');iterations=0;while(progress.pending&&iterations++<20)progress=await sync.step('owner');assert.equal(JSON.parse(academics.get(accountA).document).lessons.length,2,'Repeated imports must not duplicate lessons');



 // Automatic refresh reuses a finished catalog and resumes rather than restarts.
 const savedTransport=transport;let autoRequests=0;transport=async(...args)=>{autoRequests++;return savedTransport(...args)};
 let autoProgress=await sync.start('owner',true);assert.equal(autoProgress.pending,0);assert.equal(autoRequests,0,'Fresh catalog must not refetch upstream');
 await sync.connect('owner','test-user','test-password');const afterAuth=autoRequests;autoProgress=await sync.start('owner',true);assert.equal(autoProgress.pending,0);assert.equal(autoRequests,afterAuth,'Relogging to the same profile reuses its saved catalog');
 await sync.connect('auto-owner','test-user','test-password');autoProgress=await sync.start('auto-owner',true);assert(autoProgress.pending>0);autoProgress=await sync.step('auto-owner');const pendingBefore=autoProgress.pending,requestsBefore=autoRequests;assert.equal((await sync.start('auto-owner',true)).pending,pendingBefore);assert.equal(autoRequests,requestsBefore,'Pending automatic work must resume without resetting');transport=savedTransport;
 // Direct authenticated resources share the same encrypted jar; no new login per GET.
 const countLogin=()=>requests.filter(r=>r.method==='POST').length,loginCount=countLogin();
 let direct=await (await sync.readResource('owner',['profile'])).json();assert.equal(direct.name,'Aluno Teste');assert.equal(direct.enrollments.length,1);assert(!JSON.stringify(direct).includes('/perfil/show/'));
 direct=await (await sync.readResource('owner',['enrollments'])).json();assert.equal(direct.enrollments[0].id,'8779');
 assert.equal((await sync.readResource('owner',['home'])).status,200);
 direct=await (await sync.readResource('owner',['enrollments','8779','course'])).json();assert.equal(direct.lessons.length,2);assert(!JSON.stringify(direct).includes('path'));
 let resource=await (await sync.readResource('owner',['enrollments','8779','lessons',direct.lessons[0].id])).json();assert.equal(resource.files.length,1);
 let pdf=await sync.readResource('owner',['documents',resource.files[0].id]);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert((await pdf.text()).startsWith('%PDF-'));
 // Reading a PDF must not overwrite its lesson descriptor.
 assert.equal((await sync.readResource('owner',['enrollments','8779','lessons',direct.lessons[0].id])).status,200);
 direct=await (await sync.readResource('owner',['enrollments','8779','report-cards'])).json();assert.equal(direct.reportCards[0].officialGrade,7.24);assert(direct.reportCards[0].print.url.startsWith('/api/myid/documents/'));resource=await (await sync.readResource('owner',['documents',direct.reportCards[0].print.id])).json();assert(resource.blocks.some(b=>b.text==='Grade 7.24'));assert(!JSON.stringify(resource).includes('forbiddenScript'));
 direct=await (await sync.readResource('owner',['enrollments','8779','evaluation'])).json();assert.equal(direct.files.length,1);assert.equal((await sync.readResource('owner',['documents',direct.files[0].id])).headers.get('content-type'),'application/pdf');
 assert.equal((await sync.readResource('owner',['enrollments','8779','boletos'])).headers.get('content-type'),'application/pdf');assert.equal((await (await sync.readResource('owner',['enrollments','8779','contract'])).json()).files.length,1);
 for(const segments of [['enrollments','9999','course'],['enrollments','8779','lessons','unknown'],['documents','unknown'],['enrollments','8779','contract-review'],['profile','fields']])await assert.rejects(()=>sync.readResource('owner',segments),e=>[403,404].includes(e.status));
 assert.equal(countLogin(),loginCount,'Authenticated reads never call login again');
 // Separate platform users, profile accounts and file namespaces. Fixtures only.
 await sync.connect('live:A','test-user','test-password');await sync.connect('live:B','test-user','test-password');
 const a=(await sync.accountContext('live:A')).accountKey,b=(await sync.accountContext('live:B')).accountKey;
 assert.notEqual(a,b);assert.notEqual(sessions.get('live:A').sealed,sessions.get('live:B').sealed);
 const resourceAPI=load('app/api/myid/[...resource]/route.ts');assert.equal((await resourceAPI.GET(new Request('https://preview.test/api/myid/profile'),{params:Promise.resolve({resource:['profile']})})).status,401);const api=load('app/api/myedi/data/route.ts'),fileAPI=load('app/api/myedi/files/[id]/route.ts');
 user={userId:'C',email:'c@example.test'};let response=await api.GET();let body=await response.json();assert.equal(body.connected,false);assert.equal(body.state.courses.length,0);assert.equal(body.state.profile.name,'');
 user={userId:'A',email:'a@example.test'};await sync.start('live:A');let ap;do{ap=await sync.step('live:A')}while(ap.pending);
 body=await (await api.GET()).json();assert.equal(body.state.profile.name,'Aluno Teste');assert.equal(body.state.materials.length,5);assert(!JSON.stringify(body).includes('JSESSIONID'));assert(!JSON.stringify(body).includes('accountKey'));
 assert.equal((await resourceAPI.GET(new Request('https://preview.test/api/myid/profile?url=evil'),{params:Promise.resolve({resource:['profile']})})).status,400);assert.equal((await resourceAPI.GET(new Request('https://preview.test/api/myid/profile',{headers:{'sec-fetch-site':'cross-site'}}),{params:Promise.resolve({resource:['profile']})})).status,403);
 const fileId=body.state.materials[0].url.split('/').pop();assert.equal((await fileAPI.GET(new Request('https://preview.test'),{params:Promise.resolve({id:fileId})})).status,200);
 user={userId:'B',email:'b@example.test'};assert.equal((await fileAPI.GET(new Request('https://preview.test'),{params:Promise.resolve({id:fileId})})).status,404);
 assert.equal((await (await api.GET()).json()).state.materials.length,0);
 user={userId:'A',email:'a@example.test'};
 const put=(state,revision,origin='https://preview.test')=>api.PUT(new Request('https://preview.test/api/myedi/data',{method:'PUT',headers:{origin,'content-type':'application/json'},body:JSON.stringify({state,revision})}));
 const changed=structuredClone(body.state);changed.profile.name='Override';assert.equal((await put(changed,body.revision)).status,403);
 const own=structuredClone(body.state);own.notebooks[own.materials[0].id]='Private note';assert.equal((await put(own,body.revision)).status,200);assert.equal((await put(own,body.revision)).status,409);assert.equal((await put(own,body.revision,'https://evil.test')).status,403);
 const originalTransport=transport;
 transport=async(url,options)=>{const response=await originalTransport(url.replaceAll('fedcba4321','abcdef1234'),options);if(response.headers.get('content-type')?.includes('text/html'))return html((await response.text()).replaceAll('abcdef1234','fedcba4321').replaceAll('Aluno Teste','Outra Conta'),{headers:Object.fromEntries(response.headers)});return response};
 await sync.connect('live:A','test-user','test-password');const another=(await sync.accountContext('live:A')).accountKey;assert.notEqual(another,a);body=await (await api.GET()).json();assert.equal(body.state.profile.name,'Outra Conta');assert.equal(body.state.materials.length,0);assert.equal(Object.keys(body.state.notebooks).length,0);assert.equal((await fileAPI.GET(new Request('https://preview.test'),{params:Promise.resolve({id:fileId})})).status,404);transport=originalTransport;
 await sync.disconnect('live:A');assert.equal((await sync.status('live:B')).connected,true);assert.equal((await (await api.GET()).json()).state.courses.length,0);
 sessions.get('live:B').expires_at=0;user={userId:'B',email:'b@example.test'};assert.equal((await (await api.GET()).json()).connected,false);assert.equal((await fileAPI.GET(new Request('https://preview.test'),{params:Promise.resolve({id:fileId})})).status,401);
 user=null;assert.equal((await api.GET()).status,401);
 assert.equal((await sync.disconnect('owner')).remoteLogout,'requested');assert.equal(sessions.get('owner').sealed,'');
 const normalTransport=transport;transport=async(url,options)=>url.endsWith('/logout/index')?new Response(null,{status:503}):normalTransport(url,options);await sync.connect('owner','test-user','test-password');assert.equal((await sync.disconnect('owner')).remoteLogout,'unconfirmed');assert.equal(sessions.get('owner').sealed,'','Local session must be cleared even when remote logout fails');

 // Photo writes: one POST, fresh form version, verified image and failed redirects.
 // Transport is intercepted; no test image is sent to a real account.
 transport=normalTransport;await sync.connect('photo-owner','test-user','test-password');
 const photoAccount=(await sync.accountContext('photo-owner')).accountKey;
 const chosen=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'));
 const oldPhoto=new Uint8Array(chosen);oldPhoto[oldPhoto.length-1]^=1;
 const withPhoto=profile+'<a href="/perfil/edit/abcdef1234">Editar perfil</a><div class="caixa-foto-perfil"><img src="/storage/uploads/Perfil/abc/photo.png"></div>';
 const editPhoto='<form method="post" action="/perfil/update" enctype="multipart/form-data"><input name="id" type="hidden" value="abcdef1234"><input name="version" type="hidden" value="7"><input name="imagemUpload" type="file"><input type="submit" value="Alterar"></form>';
 let posted=0,saved=false,mode='redirect-error';
 transport=async(url,options)=>{
  if(url.endsWith('/perfil/update')){posted++;const sent=await new Response(options.body,{headers:{'content-type':options.headers['Content-Type']}}).formData();assert.equal(sent.get('id'),'abcdef1234');assert.equal(sent.get('version'),'7');assert.equal(sent.get('imagemUpload').name,'selected.png');assert.deepEqual(new Uint8Array(await sent.get('imagemUpload').arrayBuffer()),chosen);saved=mode!=='unchanged'&&mode!=='success-unchanged';if(mode==='redirect-error')return new Response(null,{status:302,headers:{location:'/perfil/curso/999'}});if(mode==='repeat-redirect')return new Response(null,{status:307,headers:{location:'/perfil/update'}});if(mode==='success'||mode==='success-unchanged')return html(withPhoto);return new Response('Not found',{status:404});}
  if(url.endsWith('/perfil/curso/999'))return new Response('Not found',{status:404});
  if(url.endsWith('/perfil/edit/abcdef1234'))return html(editPhoto);
  if(url.endsWith('/storage/uploads/Perfil/abc/photo.png'))return new Response(saved?chosen:oldPhoto,{headers:{'content-type':'image/png'}});
  if(url.endsWith('/perfil/show/abcdef1234'))return html(withPhoto);
  throw Error('Unexpected photo fixture '+url);
 };
 const selection=()=>new File([chosen],'selected.png',{type:'image/png'});
 let photoResult=await sync.uploadOriginalAvatar('photo-owner',selection());assert.equal(photoResult.reconciled,true);assert.equal(posted,1);assert.equal(JSON.parse(academics.get(photoAccount).document).connection.lastPhotoAttempt.saved,true);assert.equal(sessions.get('photo-owner').locked_until,0);
 for(mode of ['unchanged','success-unchanged']){saved=false;posted=0;await assert.rejects(()=>sync.uploadOriginalAvatar('photo-owner',selection()),e=>e.code==='PHOTO_UPDATE_FAILED');assert.equal(posted,1,'Do not replay an unconfirmed write');const attempt=JSON.parse(academics.get(photoAccount).document).connection.lastPhotoAttempt;assert.equal(attempt.saved,false);assert(attempt.trace.some(h=>h.method==='POST'));assert(!JSON.stringify(attempt).includes('test-only'));assert.equal(sessions.get('photo-owner').locked_until,0);}
 for(mode of ['success','repeat-redirect']){saved=false;posted=0;photoResult=await sync.uploadOriginalAvatar('photo-owner',selection());assert.equal(posted,1);assert(photoResult.avatar.startsWith('/api/myid/avatar?'));assert.equal(JSON.parse(academics.get(photoAccount).document).connection.lastPhotoAttempt.saved,true);}
 const avatarAPI=load('app/api/myid/avatar/route.ts');user=null;assert.equal((await avatarAPI.GET()).status,401);user={userId:'photo',email:'photo@example.test'};assert.equal((await avatarAPI.POST(new Request('https://preview.test/api/myid/avatar',{method:'POST',headers:{origin:'https://evil.test'}}))).status,403);user=null;
 transport=normalTransport;
 // HTTP requires a server-only explicit opt-in; a frontend payload cannot enable it.
 env.MYID_ORIGIN=logical;env.MYID_CONNECTION_VERIFIED='true';env.MYID_ALLOW_INSECURE_HTTP=undefined;assert.equal(sync.connectionStatus().configured,false);
 env.MYID_ALLOW_INSECURE_HTTP='true';assert.equal(sync.connectionStatus().configured,true);
 const httpCalls=[];transport=async(url,options)=>{httpCalls.push({url,method:options.method,cookie:options.headers.Cookie});assert(url.startsWith(logical+'/'));return normalTransport(url.replace(logical,origin),options)};
 const inspected=await sync.inspectConnection();assert.equal(inspected.reachable,true);assert.equal(inspected.contract.credentialFields[0],'username');assert(!JSON.stringify(inspected).includes('test-csrf'));
 await sync.connect('live:http','test-user','test-password');const postCount=httpCalls.filter(c=>c.method==='POST').length;assert.equal(postCount,1);let ownProfile=await (await sync.readResource('live:http',['profile'])).json();assert.equal(ownProfile.name,'Aluno Teste');assert.equal(httpCalls.filter(c=>c.method==='POST').length,1);assert(httpCalls.some(c=>c.cookie?.includes('test-only')));assert(!JSON.stringify(await sync.status('live:http')).includes('test-only'));await sync.disconnect('live:http');
 env.MYID_CONNECTION_VERIFIED=undefined;assert.equal(sync.connectionStatus().configured,false);

 console.log('Direct scoped resource endpoints and secure relay passed. Integration fixtures passed: form encoding/CSRF, failed login redirect, authenticated home/profile discovery, report/print/Evaluation/contract/boleto, course PDFs, idempotence, encrypted sessions and remote logout with local cleanup on failure. No live upstream requests made.');
})().catch(e=>{console.error(e);process.exitCode=1});
