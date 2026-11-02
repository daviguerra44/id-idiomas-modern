import { env } from 'cloudflare:workers';
import {emptyMyIDState} from '../myid-empty';
import { normalizeMyIDState } from '../myid-state';
import { boundedBody, decodeHtml, inspectLoginForm, LOGIN_ENTRY_PATH, LegacyClient, LegacyError, parseProfile, findProfileEditPath,parseProfileFields,parseLessons, parseFiles,lessonFileTitle, parseReports, parseReadOnlyDocument, type CookieJar, type Enrollment, type Lesson } from './protocol';
import { seal, unseal, stableId, validKey } from './vault';
import {inspectAcademicHTML} from './inspection';

type Job = { kind: 'course' | 'lesson' | 'file' | 'report' | 'evaluation' | 'boleto' | 'contract' | 'print' | 'review' | 'profile-edit'; path: string; enrollment: string; lesson?: Lesson; name?: string; lessonKey?: string; documentKind?:string };
type Resource = {id:string;enrollment:string;type:'lesson'|'document'|'pdf';path:string;name:string;lesson?:Lesson};
type Session = { autoVersion?:number;reused?:number;resources?:Resource[];accountKey:string;jar: CookieJar; profilePath: string;profileEditPath?:string; enrollments: Enrollment[]; queue: Job[]; completed: number; total: number; imported: number; warnings: string[]; startedAt: string; finishedAt?: string };
type Row = { sealed: string; expires_at: number; failures: number; retry_at: number };
const now = () => new Date().toISOString();
const AUTO_VERSION=3,REFRESH_MS=6*60*60*1000;
const priority:Record<Job['kind'],number>={course:0,report:1,lesson:2,'profile-edit':3,evaluation:4,boleto:4,contract:4,review:4,print:5,file:6};
const sortJobs=(session:Session)=>session.queue.sort((a,b)=>priority[a.kind]-priority[b.kind]);
async function finishImport(session:Session){session.finishedAt=now();await updateAcademic(session.accountKey,s=>{s.connection??={};s.connection.lastFullSyncAt=session.finishedAt;s.connection.catalogVersion=AUTO_VERSION;});}

export function connectionStatus() {
  if (!env.MYID_ORIGIN || !validKey(env.MYID_SESSION_KEY)) return { configured: false, code:'CONFIGURATION_MISSING',reason: 'MYID_ORIGIN ou a chave de sessão não está configurada no ambiente de produção.' };
  try { new LegacyClient(env.MYID_ORIGIN,{},fetch,env.MYID_TRANSPORT_ORIGIN,env.MYID_ALLOW_INSECURE_HTTP==='true'); } catch(error) { return { configured: false, code:error instanceof LegacyError?error.code:'TRANSPORT_CONFIGURATION',reason:error instanceof LegacyError?error.message:'O endereço de transporte configurado é inválido.' }; }
  if (env.MYID_CONNECTION_VERIFIED !== 'true') return { configured: false,code:'TRANSPORT_CONFIRMATION_REQUIRED',reason: 'O transporte configurado aguarda confirmação de ativação no ambiente de produção.' };
  return { configured: true, reason: '' };
}
function configuration() {
  const status = connectionStatus(); if (!status.configured) throw new LegacyError(status.code||'CONNECTION_PENDING', status.reason, 503);
  if (!env.DB || !env.BUCKET) throw new LegacyError('STORAGE_UNAVAILABLE', 'O armazenamento da integração está indisponível.', 503);
  return { db: env.DB, bucket: env.BUCKET, origin: env.MYID_ORIGIN!, transportOrigin:env.MYID_TRANSPORT_ORIGIN,allowHttp:env.MYID_ALLOW_INSECURE_HTTP==='true',key: env.MYID_SESSION_KEY! };
}
// Production reachability check: public form only, no credentials or saved session.
export async function inspectConnection(){
  const config=configuration(),client=new LegacyClient(config.origin,{},fetch,config.transportOrigin,config.allowHttp);
  const contract=inspectLoginForm(await client.html(LOGIN_ENTRY_PATH,{login:true}),config.origin);
  return {...connectionStatus(),reachable:true,contract,checkedAt:now()};
}
export async function inspectAcademic(owner:string,kind:string,enrollmentId?:string,lessonId?:string){
 if(!['profile','edit','course','lesson'].includes(kind))throw new LegacyError('INSPECTION_INVALID','Inspeção inválida.',400);
 await load(owner);await lease(owner);
 try{
  const {config,session}=await load(owner),client=new LegacyClient(config.origin,session.jar,fetch,config.transportOrigin,config.allowHttp);
  let path=session.profilePath;
  if(kind==='edit'){
   const profile=await client.html(session.profilePath);const edit=findProfileEditPath(profile,config.origin,session.profilePath);if(!edit)throw new LegacyError('PROFILE_FIELDS_NOT_FOUND','O perfil não disponibilizou edição.',404);path=edit;
  }else if(kind!=='profile'){
   const enrollment=session.enrollments.find(e=>e.id===enrollmentId);
   if(!enrollment?.links.curso)throw new LegacyError('ENROLLMENT_FORBIDDEN','O curso não está vinculado à sua sessão.',403);
   path=enrollment.links.curso;
   if(kind==='lesson'){
    const lessons=parseLessons(await client.html(path),config.origin,enrollment.id),lesson=lessons.find(l=>l.id===lessonId);
    if(!lesson)throw new LegacyError('LESSON_NOT_FOUND','A aula não foi encontrada no curso.',404);path=lesson.path;
   }
  }
  const html=await client.html(path),evidence=inspectAcademicHTML(html,config.origin);
  session.jar=client.jar;await store(owner,session);
  return {kind,path,...evidence,checkedAt:now()};
 }catch(error){if(error instanceof LegacyError&&error.code==='SESSION_EXPIRED')await env.DB!.prepare('UPDATE myid_legacy_session SET expires_at=0 WHERE owner_id=?').bind(owner).run();throw error;}
 finally{await release(owner);}
}
async function row(owner: string) { return env.DB?.prepare('SELECT sealed,expires_at,failures,retry_at FROM myid_legacy_session WHERE owner_id=?').bind(owner).first<Row>(); }
async function load(owner: string) {
  const config = configuration(), record = await row(owner);
  if (!record?.sealed || record.expires_at <= Date.now()) throw new LegacyError('SESSION_EXPIRED', 'Conecte sua conta do MyID para sincronizar.', 401);
  const session=await unseal<Session>(record.sealed,config.key,owner);
  if(!session.accountKey?.startsWith(owner+'|profile:'))throw new LegacyError('SESSION_UNREADABLE','Conecte sua conta novamente para renovar a sessão.',401);
  return {config,session};
}
export async function accountContext(owner:string){
 if(!connectionStatus().configured)return null;
 const record=await row(owner);if(!record?.sealed||record.expires_at<=Date.now())return null;
 const session=await unseal<Session>(record.sealed,env.MYID_SESSION_KEY!,owner);
 if(!session.accountKey?.startsWith(owner+'|profile:'))return null;
 return {accountKey:session.accountKey,expiresAt:record.expires_at};
}
async function store(owner: string, session: Session) {
  const config = configuration();
  await config.db.prepare('UPDATE myid_legacy_session SET sealed=?,updated_at=? WHERE owner_id=?').bind(await seal(session, config.key, owner), now(), owner).run();
}
export async function status(owner: string) {
  const config = connectionStatus(); if (!config.configured) return { ...config, connected: false };
  const record = await row(owner);
  if (!record?.sealed || record.expires_at <= Date.now()) return { ...config, connected: false };
  const session = await unseal<Session>(record.sealed, env.MYID_SESSION_KEY!, owner);
  if(!session.accountKey?.startsWith(owner+'|profile:'))return {...config,connected:false};
  return { ...config, connected: true, ...progress(session) };
}
function progress(s: Session) { return { completed: s.completed, total: s.total, pending: s.queue.length, imported: s.imported,reused:s.reused||0, warnings: s.warnings.slice(-15), finishedAt: s.finishedAt || null, startedAt: s.startedAt }; }
async function lease(owner: string) {
  const config = configuration();
  const result = await config.db.prepare('UPDATE myid_legacy_session SET locked_until=? WHERE owner_id=? AND locked_until<?').bind(Date.now()+90000,owner,Date.now()).run();
  if (!result.meta.changes){const current=await row(owner);if(!current?.sealed||current.expires_at<=Date.now())throw new LegacyError('SESSION_EXPIRED','Conecte sua conta MyID.',401);throw new LegacyError('SYNC_BUSY', 'Já existe uma operação em andamento. Aguarde alguns instantes.', 409);}
}
async function release(owner: string) { await env.DB!.prepare('UPDATE myid_legacy_session SET locked_until=0 WHERE owner_id=?').bind(owner).run(); }

export async function connect(owner: string, username: string, password: string) {
  const config = configuration();
  await config.db.prepare('INSERT OR IGNORE INTO myid_legacy_session (owner_id,sealed,expires_at,locked_until,failures,retry_at,updated_at) VALUES (?,\'\',0,0,0,0,?)').bind(owner,now()).run();
  await lease(owner);
  try {
    const current = await row(owner);
    if (current!.retry_at > Date.now()) throw new LegacyError('LOGIN_WAIT', 'Aguarde um minuto antes de tentar entrar novamente.', 429);
    const client = new LegacyClient(config.origin,{},fetch,config.transportOrigin,config.allowHttp), profile = await client.login(username,password);
    const accountKey=owner+'|profile:'+await stableId(profile.profilePath);
    const session: Session = { accountKey,jar: client.jar, profilePath: profile.profilePath, enrollments: profile.enrollments, queue: [], completed:0,total:0,imported:0,warnings:[],startedAt:now() };
    await updateAcademic(accountKey,s=>mergeProfile(s,profile));
    await config.db.prepare('UPDATE myid_legacy_session SET sealed=?,expires_at=?,failures=0,retry_at=0,updated_at=? WHERE owner_id=?').bind(await seal(session,config.key,owner),Date.now()+2*60*60*1000,now(),owner).run();
    return { connected:true, enrollments:profile.enrollments.length };
  } catch (error) {
    if (error instanceof LegacyError && error.code === 'LOGIN_FAILED') await config.db.prepare('UPDATE myid_legacy_session SET failures=failures+1,retry_at=? WHERE owner_id=?').bind(Date.now()+60000,owner).run();
    throw error;
  } finally { await release(owner); }
}
async function updateAcademic(owner: string, fn: (state: any) => void) {
  const db = env.DB!;
  await db.prepare('INSERT OR IGNORE INTO myedi_state (owner_id,document,revision,updated_at) VALUES (?,?,0,?)').bind(owner,JSON.stringify(emptyMyIDState()),now()).run();
  for (let i=0;i<3;i++) {
    const record = await db.prepare('SELECT document,revision FROM myedi_state WHERE owner_id=?').bind(owner).first<{document:string;revision:number}>();
    const state = normalizeMyIDState(JSON.parse(record!.document)).state; fn(state);
    if (JSON.stringify(state).length>2000000||state.materials.length>1000||state.lessons.length>3000||state.courses.length>300) throw new LegacyError('STATE_LIMIT','A biblioteca atingiu o limite de registros.');
    const result = await db.prepare('UPDATE myedi_state SET document=?,revision=revision+1,updated_at=? WHERE owner_id=? AND revision=?').bind(JSON.stringify(state),now(),owner,record!.revision).run();
    if (result.meta.changes) return;
  }
  throw new LegacyError('STATE_CONFLICT','Os dados mudaram em outra janela. Tente sincronizar novamente.',409);
}
function courseId(s: any, enrollment: Enrollment) { return s.courses.find((c:any)=>c.legacyEnrollmentId===enrollment.id || enrollment.registration && c.enrollment===enrollment.registration)?.id || 'legacy-course-'+enrollment.id; }
function mergeProfile(s: any, profile: ReturnType<typeof parseProfile>) {
  const permitted=new Set(profile.enrollments.map(e=>e.id));
  const previous=new Set(s.courses.filter((c:any)=>c.source==='myid').map((c:any)=>c.legacyEnrollmentId));
  const enrollmentsChanged=previous.size!==permitted.size||[...permitted].some(id=>!previous.has(id));
  s.courses=s.courses.filter((c:any)=>c.source==='myid'&&permitted.has(c.legacyEnrollmentId));
  const courseIds=new Set(s.courses.map((c:any)=>c.id));
  s.materials=s.materials.filter((m:any)=>courseIds.has(m.courseId));
  s.lessons=s.lessons.filter((l:any)=>courseIds.has(l.courseId));
  const materialIds=new Set(s.materials.map((m:any)=>m.id));
  s.completed=s.completed.filter((id:string)=>materialIds.has(id));s.favorites=s.favorites.filter((id:string)=>materialIds.has(id));
  s.notebooks=Object.fromEntries(Object.entries(s.notebooks).filter(([id])=>materialIds.has(id)));
  s.tasks=s.tasks.filter((t:any)=>!t.courseId||courseIds.has(t.courseId));s.attendance=s.attendance.filter((a:any)=>courseIds.has(a.courseId));
  if (profile.name) s.profile.name=profile.name;
  s.connection={...s.connection,status:'connected',syncedAt:now(),profileParserVersion:2};
  if(enrollmentsChanged)s.connection.catalogVersion=0;
  for (const enrollment of profile.enrollments) {
    const id=courseId(s,enrollment), teacherId='legacy-teacher-'+enrollment.id;
    if (enrollment.teacher) { const t=s.teachers.find((t:any)=>t.id===teacherId); if(t)t.name=enrollment.teacher;else s.teachers.push({id:teacherId,name:enrollment.teacher,email:'',specialty:'Idiomas'}); }
    let c=s.courses.find((c:any)=>c.id===id);
    if (!c) { c={id,title:enrollment.title||enrollment.level||'Curso',enrollment:enrollment.registration,level:enrollment.level,status:enrollment.status||'Não informado',scores:[],officialGrade:null,days:[],time:'',schedule:'Horário não informado',language:'',color:'crimson',description:'',comment:''};s.courses.push(c); }
    Object.assign(c,{legacyEnrollmentId:enrollment.id,source:'myid',syncedAt:now()});
    if(enrollment.registration)c.enrollment=enrollment.registration;
    if(enrollment.title)c.title=enrollment.title;if(enrollment.level)c.level=enrollment.level;if(enrollment.status)c.status=enrollment.status;
    if(enrollment.teacher)c.teacherId=teacherId;
    if(enrollment.language)c.language=enrollment.language;
    c.scheduleDetails=enrollment.schedule||null;c.time=enrollment.schedule?.time||'';c.schedule=enrollment.schedule?.raw||'Horário não informado';c.days=[];
    c.availableResources=Object.keys(enrollment.links);
  }
  if(!s.courses.some((c:any)=>c.id===s.settings.defaultCourse))s.settings.defaultCourse=s.courses[0]?.id||'';
}
export async function start(owner: string,automatic=false) {
  await lease(owner);
  try {
    const {config,session}=await load(owner), client=new LegacyClient(config.origin,session.jar,fetch,config.transportOrigin,config.allowHttp);
    if(automatic){
      if(session.autoVersion===AUTO_VERSION&&session.queue.length)return progress(session);
      const cached=await config.db.prepare('SELECT document,revision FROM myedi_state WHERE owner_id=?').bind(session.accountKey).first<{document:string;revision:number}>();
      const connection=cached?JSON.parse(cached.document).connection:null;
      if(connection?.catalogVersion===AUTO_VERSION&&Date.now()-Date.parse(connection.lastFullSyncAt||'')<REFRESH_MS){session.queue=[];session.autoVersion=AUTO_VERSION;session.finishedAt=connection.lastFullSyncAt;await store(owner,session);return progress(session);}
    }
    const profileHTML=await client.html(session.profilePath),profile=parseProfile(profileHTML,config.origin);
    session.enrollments=profile.enrollments;session.jar=client.jar;session.queue=[];session.completed=0;session.total=0;session.imported=0;session.reused=0;session.autoVersion=AUTO_VERSION;session.warnings=[];session.startedAt=now();delete session.finishedAt;
    session.profileEditPath=findProfileEditPath(profileHTML,config.origin,session.profilePath);
    if(session.profileEditPath)session.queue.push({kind:'profile-edit',path:session.profileEditPath,enrollment:''});
    for (const e of profile.enrollments) for (const [kind,key] of [['course','curso'],['report','reportCardMatricula'],['evaluation','evaluationMatricula'],['boleto','boletoPrint'],['contract','contratoPrint'],['review','revisarContrato']] as const) {
      if(e.links[key])session.queue.push({kind,path:e.links[key],enrollment:e.id});
    }
    sortJobs(session);session.total=session.queue.length;
    await updateAcademic(session.accountKey,s=>mergeProfile(s,profile));await store(owner,session);
    return progress(session);
  } catch(error){
    if(error instanceof LegacyError&&error.code==='SESSION_EXPIRED')await env.DB!.prepare('UPDATE myid_legacy_session SET expires_at=0 WHERE owner_id=?').bind(owner).run();
    throw error;
  } finally { await release(owner); }
}
function enqueue(session:Session,jobs:Job[]) { if(session.total+jobs.length>5000)throw new LegacyError('JOB_LIMIT','O curso excede o limite de itens por sincronização.');session.queue.push(...jobs);sortJobs(session);session.total+=jobs.length; }
export async function step(owner: string) {
  await lease(owner);
  try {
    const {config,session}=await load(owner), job=session.queue[0];if(!job)return progress(session);
    if(job.kind==='profile-edit'){
      if(job.path!==session.profileEditPath)throw new LegacyError('PROFILE_FORBIDDEN','O perfil não pertence à sessão conectada.',403);
      const client=new LegacyClient(config.origin,session.jar,fetch,config.transportOrigin,config.allowHttp);
      try{const fields=parseProfileFields(await client.html(job.path));await updateAcademic(session.accountKey,s=>s.profile.fields=fields);}catch(error){if(error instanceof LegacyError&&error.code==='SESSION_EXPIRED')await config.db.prepare('UPDATE myid_legacy_session SET expires_at=0 WHERE owner_id=?').bind(owner).run();if(!(error instanceof LegacyError)||['SESSION_EXPIRED','RATE_LIMIT','UPSTREAM_UNAVAILABLE','STATE_CONFLICT'].includes(error.code))throw error;session.warnings.push(error.message);}
      session.jar=client.jar;session.queue.shift();session.completed++;if(!session.queue.length)await finishImport(session);await store(owner,session);return progress(session);
    }
    const enrollment=session.enrollments.find(e=>e.id===job.enrollment);
    if(!enrollment)throw new LegacyError('ENROLLMENT_FORBIDDEN','A matrícula não pertence à sessão conectada.',403);
    const client=new LegacyClient(config.origin,session.jar,fetch,config.transportOrigin,config.allowHttp);
    try {
      if(job.kind==='file') {
        await importFile(config,session,enrollment,client,job);
      } else {
        const response=await client.request(job.path), type=(response.headers.get('content-type')||'').toLowerCase();
        if(type.includes('application/pdf')){
          await response.body?.cancel();
          if(job.kind==='lesson')enqueue(session,[{...job,kind:'file',name:job.lesson?.title||'Material da aula'}]);
          else if(['boleto','contract','evaluation','print'].includes(job.kind))enqueue(session,[{...job,kind:'file',documentKind:job.documentKind||job.kind,name:job.kind==='boleto'?'Boleto.pdf':job.kind==='contract'?'Contrato.pdf':job.kind==='print'?'Report Card.pdf':'Evaluation.pdf'}]);
          else throw new LegacyError('HTML_EXPECTED','O formato da página mudou.');
          if(job.kind==='lesson')await upsertLesson(session.accountKey,enrollment,job);
        }else{
          if(!type.includes('text/html'))throw new LegacyError('HTML_EXPECTED','O formato da página mudou.');
          const html=await decodeHtml(response);
          if(job.kind==='course'){
            const lessons=parseLessons(html,config.origin,enrollment.id);if(!lessons.length)throw new LegacyError('LESSONS_NOT_FOUND','Nenhuma aula foi identificada no curso '+(enrollment.registration||enrollment.id)+'. Os materiais existentes foram mantidos.');
            await updateAcademic(session.accountKey,s=>{for(const l of lessons)mergeLesson(s,enrollment,{kind:'lesson',path:l.path,enrollment:enrollment.id,lesson:l,lessonKey:'legacy-lesson-'+enrollment.id+'-'+l.id});});
            enqueue(session,lessons.map(l=>({kind:'lesson',path:l.path,enrollment:enrollment.id,lesson:l,lessonKey:'legacy-lesson-'+enrollment.id+'-'+l.id})));
          }else if(job.kind==='lesson'){
            const files=parseFiles(html,config.origin);if(!files.length)throw new LegacyError('FILES_NOT_FOUND','Nenhum PDF foi identificado na aula '+job.lesson!.title+'.');
            await upsertLesson(session.accountKey,enrollment,job);
            for(const file of files){const linked=await registerResource(session,{type:'pdf',enrollment:enrollment.id,path:file.path,name:file.name});const id=await stableId(session.accountKey+'|'+file.path);await saveFileRecord(session,enrollment,{...job,kind:'file',path:file.path,name:lessonFileTitle(job.lesson!,file)},id,linked.url,true);}
            enqueue(session,files.map(f=>({...job,kind:'file',path:f.path,name:lessonFileTitle(job.lesson!,f)})));
          }else if(job.kind==='report'){
            const reports=parseReports(html,config.origin);
            enqueue(session,reports.filter(r=>r.available&&r.printPath).map(r=>({kind:'print',path:r.printPath!,enrollment:enrollment.id,documentKind:'report-print-'+r.number})));
            const normalized=reports.map(({printPath,...r})=>r);
            await updateAcademic(session.accountKey,s=>{const c=s.courses.find((c:any)=>c.id===courseId(s,enrollment));if(!c)return;c.reportCards=normalized;c.syncedAt=now();const r=normalized.filter(r=>r.available).at(-1);c.scores=r?.scores||[];c.officialGrade=r?.officialGrade??null;c.comment=r?.comment||''; });
          }else{
            const parsed=parseReadOnlyDocument(html,config.origin);
            const documentKind=job.documentKind||job.kind;
            await updateAcademic(session.accountKey,s=>{const c=s.courses.find((c:any)=>c.id===courseId(s,enrollment));if(c){c.documents??={};c.documents[documentKind]={blocks:parsed.blocks,materialIds:c.documents[documentKind]?.materialIds||[],syncedAt:now()};}});
            enqueue(session,parsed.files.map(f=>({kind:'file',path:f.path,enrollment:enrollment.id,name:f.name,documentKind})));
          }
        }
      }
    }catch(error){
      if(error instanceof LegacyError&&error.code==='SESSION_EXPIRED')await config.db.prepare('UPDATE myid_legacy_session SET expires_at=0 WHERE owner_id=?').bind(owner).run();
      if(!(error instanceof LegacyError)||['SESSION_EXPIRED','RATE_LIMIT','UPSTREAM_UNAVAILABLE','STATE_CONFLICT'].includes(error.code))throw error;
      session.warnings.push(error.message);if(session.warnings.length>100)session.warnings.shift();
    }
    session.jar=client.jar;session.queue.shift();session.completed++;if(!session.queue.length)await finishImport(session);await store(owner,session);
    return progress(session);
  }finally{await release(owner);}
}
async function saveFileRecord(session:Session,enrollment:Enrollment,job:Job,id:string,url:string,pendingDownload=false){
 await updateAcademic(session.accountKey,s=>{
  const cId=courseId(s,enrollment),materialId='legacy-pdf-'+id+'-'+(job.lessonKey||enrollment.id+'-'+(job.documentKind||'document'));
  const material={id:materialId,courseId:cId,lessonId:job.lessonKey||'',title:job.name||'Material da aula',type:'pdf',url,section:job.lesson?.title||'Documentos',category:job.lessonKey?'course':'document',source:'myid',syncedAt:now(),archived:false,pendingDownload};
  const old=s.materials.find((m:any)=>m.id===materialId);
  if(old){if(!pendingDownload||old.pendingDownload)Object.assign(old,material);}else s.materials.push(material);
  if(job.lessonKey){const lesson=s.lessons.find((l:any)=>l.id===job.lessonKey);if(lesson&&!lesson.materialIds.includes(materialId))lesson.materialIds.push(materialId);}
  if(job.documentKind){const c=s.courses.find((c:any)=>c.id===cId);if(c){c.documents??={};const document=c.documents[job.documentKind]??={blocks:[],materialIds:[]};document.materialIds??=[];if(!document.materialIds.includes(materialId))document.materialIds.push(materialId);document.syncedAt=now();}}
 });
}
async function importFile(config:ReturnType<typeof configuration>,session:Session,enrollment:Enrollment,client:LegacyClient,job:Job){
 const id=await stableId(session.accountKey+'|'+job.path),key=session.accountKey+'/'+id;
 const existing=await config.bucket.head?.(key);
 if(!existing){
  const response=await client.request(job.path);if((response.headers.get('content-type')||'').includes('text/html')){parseFiles(await decodeHtml(response),config.origin);throw new LegacyError('PDF_EXPECTED','O anexo não retornou um PDF.');}
  const bytes=await boundedBody(response,20*1024*1024);if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new LegacyError('PDF_EXPECTED','Um anexo não é PDF e não foi importado.');
  const baseName=(job.name||'Material.pdf').replace(/[\r\n"\\]/g,'_').slice(0,120),name=/\.pdf$/i.test(baseName)?baseName:baseName+'.pdf';
  await config.bucket.put(key,bytes,{httpMetadata:{contentType:'application/pdf'},customMetadata:{name}});
 }else session.reused=(session.reused||0)+1;
 await saveFileRecord(session,enrollment,job,id,'/api/myedi/files/'+id);
 session.imported++;return {url:'/api/myedi/files/'+id,title:job.name||'Material da aula'};
}
function mergeLesson(s:any,enrollment:Enrollment,job:Job){
 const lesson=job.lesson!;const item={id:job.lessonKey,courseId:courseId(s,enrollment),title:lesson.title,unit:lesson.unit,sequence:lesson.sequence,lessonNumber:lesson.lessonNumber,sourceLabel:lesson.sourceLabel,sourceUnit:lesson.sourceUnit,date:'',description:'',materialIds:[],source:'myid',syncedAt:now(),archived:false};
 const old=s.lessons.find((l:any)=>l.id===item.id);if(old)Object.assign(old,{...item,materialIds:old.materialIds});else s.lessons.push(item);
}
async function upsertLesson(owner:string,enrollment:Enrollment,job:Job){await updateAcademic(owner,s=>mergeLesson(s,enrollment,job));}

const resourceJSON=(value:unknown)=>Response.json(value,{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
function enrollmentView(e:Enrollment){const {links,...data}=e;return {...data,available:Object.keys(links)};}
async function registerResource(session:Session,resource:Omit<Resource,'id'>){
  const id=await stableId(session.accountKey+'|'+resource.enrollment+'|'+resource.type+'|'+resource.path);
  session.resources??=[];
  const old=session.resources.find(r=>r.id===id);
  if(old)Object.assign(old,resource);else{if(session.resources.length>=5000)throw new LegacyError('RESOURCE_LIMIT','Limite de recursos por sessão atingido.');session.resources.push({id,...resource});}
  return {id,name:resource.name,url:'/api/myid/documents/'+id};
}

// All target paths come from this user's encrypted session or authenticated HTML.
// Browser route segments select capabilities, never an arbitrary upstream URL.
export async function readResource(owner:string,segments:string[]):Promise<Response>{
  await load(owner);await lease(owner);
  try{
    const {config,session}=await load(owner),client=new LegacyClient(config.origin,session.jar,fetch,config.transportOrigin,config.allowHttp);
    const finish=async(response:Response)=>{session.jar=client.jar;await store(owner,session);return response;};
    const refreshProfile=async()=>{
      const html=await client.html(session.profilePath),profile=parseProfile(html,config.origin);
      session.enrollments=profile.enrollments;
      session.resources=(session.resources||[]).filter(r=>session.enrollments.some(e=>e.id===r.enrollment));
      session.profileEditPath=findProfileEditPath(html,config.origin,session.profilePath);
      await updateAcademic(session.accountKey,s=>mergeProfile(s,profile));return profile;
    };
    const saveDocument=async(enrollment:Enrollment,kind:string,html:string)=>{
      const parsed=parseReadOnlyDocument(html,config.origin),files=[];
      for(const file of parsed.files)files.push(await registerResource(session,{enrollment:enrollment.id,type:'pdf',path:file.path,name:file.name}));
      await updateAcademic(session.accountKey,s=>{const c=s.courses.find((c:any)=>c.id===courseId(s,enrollment));if(c){c.documents??={};c.documents[kind]={blocks:parsed.blocks,materialIds:c.documents[kind]?.materialIds||[],syncedAt:now()};}});
      return {blocks:parsed.blocks,files};
    };
    const pdfResponse=async(response:Response,name:string)=>{
      const bytes=await boundedBody(response,20*1024*1024);
      if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new LegacyError('PDF_EXPECTED','O documento não retornou um PDF válido.');
      const safeName=name.replace(/[\r\n"\\]/g,'_').slice(0,160),ascii=safeName.replace(/[^\x20-\x7e]/g,'_');
      return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    };
    if(segments.length===1&&['profile','enrollments'].includes(segments[0])){
      const profile=await refreshProfile();
      return await finish(resourceJSON(segments[0]==='profile'?{name:profile.name,enrollments:profile.enrollments.map(enrollmentView)}:{enrollments:profile.enrollments.map(enrollmentView)}));
    }
    if(segments.length===1&&segments[0]==='home'){
      const parsed=parseReadOnlyDocument(await client.html('/perfil/home'),config.origin);
      return await finish(resourceJSON({blocks:parsed.blocks}));
    }
    if(segments.length===2&&segments[0]==='profile'&&segments[1]==='fields'){
      await refreshProfile();if(!session.profileEditPath)throw new LegacyError('RESOURCE_UNAVAILABLE','O perfil não disponibilizou o link de edição.',404);
      const fields=parseProfileFields(await client.html(session.profileEditPath));await updateAcademic(session.accountKey,s=>s.profile.fields=fields);
      return await finish(resourceJSON({fields,readOnly:true}));
    }
    if(segments.length===2&&segments[0]==='documents'){
      const resource=session.resources?.find(r=>r.id===segments[1]&&r.type!=='lesson');
      if(!resource||!session.enrollments.some(e=>e.id===resource.enrollment))throw new LegacyError('RESOURCE_NOT_FOUND','Documento não vinculado à sua sessão.',404);
      const response=await client.request(resource.path),type=response.headers.get('content-type')||'';
      if(type.toLowerCase().includes('application/pdf'))return await finish(await pdfResponse(response,resource.name));
      const html=await decodeHtml(response); // Also detects a login returned with HTTP 200.
      const document=await saveDocument(session.enrollments.find(e=>e.id===resource.enrollment)!,'document-'+resource.id,html);
      if(resource.type==='pdf')throw new LegacyError('PDF_EXPECTED','O anexo retornou HTML em vez de PDF.');
      return await finish(resourceJSON(document));
    }
    if(segments[0]!=='enrollments'||!/^\d+$/.test(segments[1]||'')||![3,4].includes(segments.length))throw new LegacyError('RESOURCE_NOT_FOUND','Consulta não reconhecida.',404);
    const enrollment=session.enrollments.find(e=>e.id===segments[1]);
    if(!enrollment)throw new LegacyError('ENROLLMENT_FORBIDDEN','A matrícula não pertence à sua sessão.',403);
    const kind=segments[2];
    if(kind==='lessons'&&segments.length===4){
      const resource=session.resources?.find(r=>r.type==='lesson'&&r.enrollment===enrollment.id&&r.lesson?.id===segments[3]);
      if(!resource)throw new LegacyError('LESSON_NOT_FOUND','Consulte o curso antes de acessar uma aula vinculada.',404);
      const response=await client.request(resource.path);let attachments:{path:string;name:string}[]=[];
      if((response.headers.get('content-type')||'').toLowerCase().includes('application/pdf')){await response.body?.cancel();attachments=[{path:resource.path,name:resource.name+'.pdf'}];}
      else attachments=parseFiles(await decodeHtml(response),config.origin);
      if(!attachments.length)throw new LegacyError('FILES_NOT_FOUND','Nenhum PDF foi identificado na resposta da aula.');
      if(attachments.length>20)throw new LegacyError('FILE_LIMIT','A aula excede o limite de anexos por consulta.');
      const lessonKey='legacy-lesson-'+enrollment.id+'-'+resource.lesson!.id;
      await upsertLesson(session.accountKey,enrollment,{kind:'lesson',path:resource.path,enrollment:enrollment.id,lesson:resource.lesson,lessonKey});
      const files=[];
      for(const file of attachments){
        const linked=await registerResource(session,{type:'pdf',enrollment:enrollment.id,path:file.path,name:file.name});
        const cached=await importFile(config,session,enrollment,client,{kind:'file',path:file.path,enrollment:enrollment.id,name:lessonFileTitle(resource.lesson!,file),lesson:resource.lesson,lessonKey});
        files.push({...linked,cachedUrl:cached.url});
      }
      const {path,...lesson}=resource.lesson!;return await finish(resourceJSON({lesson,files}));
    }
    const kinds:Record<string,string>={'report-cards':'reportCardMatricula',evaluation:'evaluationMatricula',course:'curso',boletos:'boletoPrint',contract:'contratoPrint','contract-review':'revisarContrato'};
    const path=enrollment.links[kinds[kind]];
    if(segments.length!==3||!path)throw new LegacyError('RESOURCE_UNAVAILABLE','A matrícula não disponibilizou esse recurso.',404);
    const response=await client.request(path),type=(response.headers.get('content-type')||'').toLowerCase();
    if(type.includes('application/pdf'))return await finish(await pdfResponse(response,kind+'.pdf'));
    const html=await decodeHtml(response);
    if(kind==='course'){
      const lessons=parseLessons(html,config.origin,enrollment.id),result=[];
      await updateAcademic(session.accountKey,s=>{for(const lesson of lessons)mergeLesson(s,enrollment,{kind:'lesson',path:lesson.path,enrollment:enrollment.id,lesson,lessonKey:'legacy-lesson-'+enrollment.id+'-'+lesson.id});const c=s.courses.find((c:any)=>c.id===courseId(s,enrollment));if(c)c.courseSyncedAt=now();});
      for(const lesson of lessons){await registerResource(session,{type:'lesson',enrollment:enrollment.id,path:lesson.path,name:lesson.title,lesson});const {path,...data}=lesson;result.push({...data,url:'/api/myid/enrollments/'+enrollment.id+'/lessons/'+lesson.id});}
      return await finish(resourceJSON({enrollment:enrollmentView(enrollment),lessons:result}));
    }
    if(kind==='report-cards'){
      const reports=parseReports(html,config.origin),result=[];
      for(const report of reports){const {printPath,...data}=report;const print=printPath?await registerResource(session,{type:'document',enrollment:enrollment.id,path:printPath,name:'Report Card '+report.number+'.pdf'}):undefined;result.push({...data,...(print?{print}:{}),teacher:enrollment.teacher});}
      await updateAcademic(session.accountKey,s=>{const c=s.courses.find((c:any)=>c.id===courseId(s,enrollment));if(c){c.reportCards=reports.map(({printPath,...r})=>r);const report=reports.filter(r=>r.available).at(-1);c.scores=report?.scores||[];c.officialGrade=report?.officialGrade??null;c.comment=report?.comment||'';c.syncedAt=now();}});
      return await finish(resourceJSON({reportCards:result}));
    }
    return await finish(resourceJSON(await saveDocument(enrollment,kind==='boletos'?'boleto':kind==='contract-review'?'review':kind,html)));
  }catch(error){
    if(error instanceof LegacyError&&error.code==='SESSION_EXPIRED')await env.DB!.prepare('UPDATE myid_legacy_session SET expires_at=0 WHERE owner_id=?').bind(owner).run();
    throw error;
  }finally{await release(owner);}
}
export async function disconnect(owner:string) {
  if(!env.DB)return {connected:false,remoteLogout:'not_attempted'};
  const existing=await env.DB.prepare('SELECT sealed,expires_at,locked_until FROM myid_legacy_session WHERE owner_id=?').bind(owner).first<Row&{locked_until:number}>();
  if(!existing)return {connected:false,remoteLogout:'not_attempted'};
  const result=await env.DB.prepare('UPDATE myid_legacy_session SET locked_until=? WHERE owner_id=? AND locked_until<?').bind(Date.now()+90000,owner,Date.now()).run();
  if(!result.meta.changes)throw new LegacyError('SYNC_BUSY','Aguarde a operação atual terminar antes de desconectar.',409);
  let remoteLogout='not_attempted',warning='';
  try{
    if(existing.sealed&&existing.expires_at>Date.now()&&connectionStatus().configured){
      const config=configuration(),session=await unseal<Session>(existing.sealed,config.key,owner);
      await new LegacyClient(config.origin,session.jar,fetch,config.transportOrigin,config.allowHttp).logout();remoteLogout='requested';
    }
  }catch{remoteLogout='unconfirmed';warning='A conexão local foi encerrada, mas o encerramento no portal original não pôde ser confirmado.';}
  finally{await env.DB.prepare('UPDATE myid_legacy_session SET sealed=\'\',expires_at=0,locked_until=0,updated_at=? WHERE owner_id=?').bind(now(),owner).run();}
  return {connected:false,remoteLogout,...(warning?{warning}:{})};
}
