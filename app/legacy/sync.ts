import { env } from 'cloudflare:workers';
import seed from '../../site/seed.json';
import { normalizeMyIDState } from '../myid-state';
import { boundedBody, LegacyClient, LegacyError, parseProfile, parseLessons, parseFiles, parseReports, parseReadOnlyDocument, type CookieJar, type Enrollment, type Lesson } from './protocol';
import { seal, unseal, stableId, validKey } from './vault';

type Job = { kind: 'course' | 'lesson' | 'file' | 'report' | 'evaluation' | 'boleto' | 'contract'; path: string; enrollment: string; lesson?: Lesson; name?: string; lessonKey?: string };
type Session = { jar: CookieJar; profilePath: string; enrollments: Enrollment[]; queue: Job[]; completed: number; total: number; imported: number; warnings: string[]; startedAt: string; finishedAt?: string };
type Row = { sealed: string; expires_at: number; failures: number; retry_at: number };
const now = () => new Date().toISOString();

export function connectionStatus() {
  if (env.MYID_CONNECTION_VERIFIED !== 'true') return { configured: false, reason: 'A conexão com o portal original ainda precisa ser validada em HTTPS.' };
  if (!env.MYID_ORIGIN || !validKey(env.MYID_SESSION_KEY)) return { configured: false, reason: 'A configuração segura da integração ainda não foi concluída.' };
  try { new LegacyClient(env.MYID_ORIGIN); } catch { return { configured: false, reason: 'A integração requer o endereço HTTPS verificado do MyID.' }; }
  return { configured: true, reason: '' };
}
function configuration() {
  const status = connectionStatus(); if (!status.configured) throw new LegacyError('CONNECTION_PENDING', status.reason, 503);
  if (!env.DB || !env.BUCKET) throw new LegacyError('STORAGE_UNAVAILABLE', 'O armazenamento da integração está indisponível.', 503);
  return { db: env.DB, bucket: env.BUCKET, origin: env.MYID_ORIGIN!, key: env.MYID_SESSION_KEY! };
}
async function row(owner: string) { return env.DB?.prepare('SELECT sealed,expires_at,failures,retry_at FROM myid_legacy_session WHERE owner_id=?').bind(owner).first<Row>(); }
async function load(owner: string) {
  const config = configuration(), record = await row(owner);
  if (!record?.sealed || record.expires_at <= Date.now()) throw new LegacyError('SESSION_EXPIRED', 'Conecte sua conta do MyID para sincronizar.', 401);
  return { config, session: await unseal<Session>(record.sealed, config.key, owner) };
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
  return { ...config, connected: true, ...progress(session) };
}
function progress(s: Session) { return { completed: s.completed, total: s.total, pending: s.queue.length, imported: s.imported, warnings: s.warnings.slice(-15), finishedAt: s.finishedAt || null, startedAt: s.startedAt }; }
async function lease(owner: string) {
  const config = configuration();
  const result = await config.db.prepare('UPDATE myid_legacy_session SET locked_until=? WHERE owner_id=? AND locked_until<?').bind(Date.now()+90000,owner,Date.now()).run();
  if (!result.meta.changes) throw new LegacyError('SYNC_BUSY', 'Já existe uma operação em andamento. Aguarde alguns instantes.', 409);
}
async function release(owner: string) { await env.DB!.prepare('UPDATE myid_legacy_session SET locked_until=0 WHERE owner_id=?').bind(owner).run(); }

export async function connect(owner: string, username: string, password: string) {
  const config = configuration();
  await config.db.prepare('INSERT OR IGNORE INTO myid_legacy_session (owner_id,sealed,expires_at,locked_until,failures,retry_at,updated_at) VALUES (?,\'\',0,0,0,0,?)').bind(owner,now()).run();
  await lease(owner);
  try {
    const current = await row(owner);
    if (current!.retry_at > Date.now()) throw new LegacyError('LOGIN_WAIT', 'Aguarde um minuto antes de tentar entrar novamente.', 429);
    const client = new LegacyClient(config.origin), profile = await client.login(username,password);
    const session: Session = { jar: client.jar, profilePath: profile.profilePath, enrollments: profile.enrollments, queue: [], completed:0,total:0,imported:0,warnings:[],startedAt:now() };
    await config.db.prepare('UPDATE myid_legacy_session SET sealed=?,expires_at=?,failures=0,retry_at=0,updated_at=? WHERE owner_id=?').bind(await seal(session,config.key,owner),Date.now()+2*60*60*1000,now(),owner).run();
    return { connected:true, enrollments:profile.enrollments.length };
  } catch (error) {
    if (error instanceof LegacyError && error.code === 'LOGIN_FAILED') await config.db.prepare('UPDATE myid_legacy_session SET failures=failures+1,retry_at=? WHERE owner_id=?').bind(Date.now()+60000,owner).run();
    throw error;
  } finally { await release(owner); }
}
async function updateAcademic(owner: string, fn: (state: any) => void) {
  const db = env.DB!;
  await db.prepare('INSERT OR IGNORE INTO myedi_state (owner_id,document,revision,updated_at) VALUES (?,?,0,?)').bind(owner,JSON.stringify(seed),now()).run();
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
  if (profile.name) s.profile.name=profile.name;
  for (const enrollment of profile.enrollments) {
    const id=courseId(s,enrollment), teacherId='legacy-teacher-'+enrollment.id;
    if (enrollment.teacher) { const t=s.teachers.find((t:any)=>t.id===teacherId); if(t)t.name=enrollment.teacher;else s.teachers.push({id:teacherId,name:enrollment.teacher,email:'',specialty:'Idiomas'}); }
    let c=s.courses.find((c:any)=>c.id===id);
    if (!c) { c={id,title:enrollment.title||enrollment.level||'Curso',enrollment:enrollment.registration,level:enrollment.level,status:enrollment.status||'Não informado',scores:[],officialGrade:null,days:[],time:'',schedule:'Horário não informado',language:'',color:'crimson',description:'',comment:''};s.courses.push(c); }
    Object.assign(c,{legacyEnrollmentId:enrollment.id,source:'myid',syncedAt:now()});
    if(enrollment.registration)c.enrollment=enrollment.registration;
    if(enrollment.title)c.title=enrollment.title;if(enrollment.level)c.level=enrollment.level;if(enrollment.status)c.status=enrollment.status;
    if(enrollment.teacher)c.teacherId=teacherId;
  }
}
export async function start(owner: string) {
  await lease(owner);
  try {
    const {config,session}=await load(owner), client=new LegacyClient(config.origin,session.jar);
    const profile=parseProfile(await client.html(session.profilePath),config.origin);
    session.enrollments=profile.enrollments;session.jar=client.jar;session.queue=[];session.completed=0;session.total=0;session.imported=0;session.warnings=[];session.startedAt=now();delete session.finishedAt;
    for (const e of profile.enrollments) for (const [kind,key] of [['course','curso'],['report','reportCardMatricula'],['evaluation','evaluationMatricula'],['boleto','boletoPrint'],['contract','contratoPrint']] as const) {
      if(e.links[key])session.queue.push({kind,path:e.links[key],enrollment:e.id});
    }
    session.total=session.queue.length;
    await updateAcademic(owner,s=>mergeProfile(s,profile));await store(owner,session);
    return progress(session);
  } finally { await release(owner); }
}
function enqueue(session:Session,jobs:Job[]) { if(session.total+jobs.length>5000)throw new LegacyError('JOB_LIMIT','O curso excede o limite de itens por sincronização.');session.queue.push(...jobs);session.total+=jobs.length; }
export async function step(owner: string) {
  await lease(owner);
  try {
    const {config,session}=await load(owner), job=session.queue[0];if(!job)return progress(session);
    const enrollment=session.enrollments.find(e=>e.id===job.enrollment);
    if(!enrollment)throw new LegacyError('ENROLLMENT_FORBIDDEN','A matrícula não pertence à sessão conectada.',403);
    const client=new LegacyClient(config.origin,session.jar);
    try {
      if(job.kind==='file') {
        const response=await client.request(job.path), bytes=await boundedBody(response,20*1024*1024);
        if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new LegacyError('PDF_EXPECTED','Um anexo não é PDF e não foi importado.');
        const id=await stableId(owner+'|'+job.path), name=(job.name||'Material.pdf').replace(/[\r\n"\\]/g,'_').slice(0,120);
        await config.bucket.put(owner+'/'+id,bytes,{httpMetadata:{contentType:'application/pdf'},customMetadata:{name}});
        await updateAcademic(owner,s=>{
          const cId=courseId(s,enrollment), materialId='legacy-pdf-'+id+'-'+(job.lessonKey||enrollment.id);
          const material={id:materialId,courseId:cId,lessonId:job.lessonKey||'',title:job.name||'Material da aula',type:'pdf',url:'/api/myedi/files/'+id,section:job.lesson?.title||'Documentos',category:job.lessonKey?'course':'document',source:'myid',syncedAt:now(),archived:false};
          const old=s.materials.find((m:any)=>m.id===materialId);if(old)Object.assign(old,material);else s.materials.push(material);
          if(job.lessonKey){const lesson=s.lessons.find((l:any)=>l.id===job.lessonKey);if(lesson&&!lesson.materialIds.includes(materialId))lesson.materialIds.push(materialId);}
        });session.imported++;
      } else {
        const response=await client.request(job.path), type=response.headers.get('content-type')||'';
        if(type.includes('application/pdf')){
          await response.body?.cancel();
          if(job.kind==='lesson')enqueue(session,[{...job,kind:'file',name:job.lesson?.title||'Material da aula'}]);
          else if(['boleto','contract','evaluation'].includes(job.kind))enqueue(session,[{...job,kind:'file',name:job.kind==='boleto'?'Boleto.pdf':job.kind==='contract'?'Contrato.pdf':'Evaluation.pdf'}]);
          else throw new LegacyError('HTML_EXPECTED','O formato da página mudou.');
          if(job.kind==='lesson')await upsertLesson(owner,enrollment,job);
        }else{
          if(!type.includes('text/html'))throw new LegacyError('HTML_EXPECTED','O formato da página mudou.');
          const html=new TextDecoder().decode(await boundedBody(response,2*1024*1024));
          if(job.kind==='course'){
            const lessons=parseLessons(html,config.origin,enrollment.id);if(!lessons.length)throw new LegacyError('LESSONS_NOT_FOUND','Nenhuma aula foi identificada no curso '+(enrollment.registration||enrollment.id)+'. Os materiais existentes foram mantidos.');
            enqueue(session,lessons.map(l=>({kind:'lesson',path:l.path,enrollment:enrollment.id,lesson:l,lessonKey:'legacy-lesson-'+enrollment.id+'-'+l.id})));
          }else if(job.kind==='lesson'){
            const files=parseFiles(html,config.origin);if(!files.length)throw new LegacyError('FILES_NOT_FOUND','Nenhum PDF foi identificado na aula '+job.lesson!.title+'.');
            await upsertLesson(owner,enrollment,job);
            enqueue(session,files.map(f=>({...job,kind:'file',path:f.path,name:job.lesson!.title+' · '+f.name})));
          }else if(job.kind==='report'){
            const reports=parseReports(html);
            await updateAcademic(owner,s=>{const c=s.courses.find((c:any)=>c.id===courseId(s,enrollment));if(!c)return;c.reportCards=reports;c.syncedAt=now();const r=reports.filter(r=>r.available).at(-1);c.scores=r?.scores||[];c.officialGrade=r?.officialGrade??null;c.comment=r?.comment||''; });
          }else{
            const parsed=parseReadOnlyDocument(html,config.origin);
            await updateAcademic(owner,s=>{const c=s.courses.find((c:any)=>c.id===courseId(s,enrollment));if(c){c.documents??={};c.documents[job.kind]={blocks:parsed.blocks,syncedAt:now()};}});
            enqueue(session,parsed.files.map(f=>({kind:'file',path:f.path,enrollment:enrollment.id,name:f.name})));
          }
        }
      }
    }catch(error){
      if(error instanceof LegacyError&&error.code==='SESSION_EXPIRED')await config.db.prepare('UPDATE myid_legacy_session SET expires_at=0 WHERE owner_id=?').bind(owner).run();
      if(!(error instanceof LegacyError)||['SESSION_EXPIRED','RATE_LIMIT','UPSTREAM_UNAVAILABLE','STATE_CONFLICT'].includes(error.code))throw error;
      session.warnings.push(error.message);if(session.warnings.length>100)session.warnings.shift();
    }
    session.jar=client.jar;session.queue.shift();session.completed++;if(!session.queue.length)session.finishedAt=now();await store(owner,session);
    return progress(session);
  }finally{await release(owner);}
}
async function upsertLesson(owner:string,enrollment:Enrollment,job:Job){
  const lesson=job.lesson!;
  await updateAcademic(owner,s=>{const item={id:job.lessonKey,courseId:courseId(s,enrollment),title:lesson.title,unit:lesson.unit,sequence:lesson.sequence,date:'',description:'',materialIds:[],source:'myid',syncedAt:now(),archived:false};const old=s.lessons.find((l:any)=>l.id===item.id);if(old)Object.assign(old,{...item,materialIds:old.materialIds});else s.lessons.push(item);});
}
export async function disconnect(owner:string) {
  if(!env.DB)return;
  const existing=await env.DB.prepare('SELECT locked_until FROM myid_legacy_session WHERE owner_id=?').bind(owner).first<{locked_until:number}>();
  if(existing&&existing.locked_until>=Date.now())throw new LegacyError('SYNC_BUSY','Aguarde a operação atual terminar antes de desconectar.',409);
  // Remove the encrypted local session; do not perform an unverified upstream logout.
  const result=await env.DB.prepare('UPDATE myid_legacy_session SET sealed=\'\',expires_at=0,locked_until=0,updated_at=? WHERE owner_id=? AND locked_until<?').bind(now(),owner,Date.now()).run();
  if(existing&&!result.meta.changes)throw new LegacyError('SYNC_BUSY','Uma operação foi iniciada em outra janela. Tente desconectar novamente.',409);
}
