import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { myIDAccess } from '../../../myid-access';
import seed from '../../../../site/seed.json';
import { normalizeMyIDState } from '../../../myid-state';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const validDate=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value};
async function identity(){ return myIDAccess(await getChatGPTUser()); }
export async function GET(){
 const access=await identity();if(!access)return json({error:'Entre na sua conta para acessar o MyID.'},401);
 const owner=access.ownerId;
 if(!env.DB)return json({error:'Banco de dados indisponível.'},503);
 await env.DB.prepare('INSERT OR IGNORE INTO myedi_state (owner_id,document,revision,updated_at) VALUES (?,?,0,?)').bind(owner,JSON.stringify(seed),new Date().toISOString()).run();
 let row=await env.DB.prepare('SELECT document,revision,updated_at FROM myedi_state WHERE owner_id=?').bind(owner).first<{document:string,revision:number,updated_at:string}>();
 const normalized=normalizeMyIDState(JSON.parse(row!.document));
 if(normalized.changed){await env.DB.prepare('UPDATE myedi_state SET document=?,revision=revision+1,updated_at=? WHERE owner_id=? AND revision=?').bind(JSON.stringify(normalized.state),new Date().toISOString(),owner,row!.revision).run();row=await env.DB.prepare('SELECT document,revision,updated_at FROM myedi_state WHERE owner_id=?').bind(owner).first<{document:string,revision:number,updated_at:string}>();}
 return json({state:JSON.parse(row!.document),revision:row!.revision,updatedAt:row!.updated_at,canAdmin:access.canAdmin,readOnly:access.readOnly});
}
export async function PUT(request:Request){
 const access=await identity();if(!access)return json({error:'Sessão expirada. Entre novamente.'},401);
 if(!access.canAdmin)return json({error:'Acesso de visualização. Apenas o administrador pode alterar os dados.'},403);
 const owner=access.ownerId;
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 if(!env.DB)return json({error:'Banco indisponível.'},503);
 const raw=await request.text();if(raw.length>2000000)return json({error:'Dados acima do limite.'},413);
 let payload;try{payload=JSON.parse(raw)}catch{return json({error:'Dados inválidos.'},400)}
 const {revision}=payload;
 let state=payload.state;
 if(!state||!state.profile||typeof state.profile.name!=='string'||!state.profile.name.trim()||state.profile.name.length>100||!Number.isInteger(revision)||!Array.isArray(state.courses)||!Array.isArray(state.teachers)||!Array.isArray(state.materials)||!Array.isArray(state.tasks)||state.courses.length>300||state.teachers.length>300||state.materials.length>1000||state.tasks.length>1000)return json({error:'Verifique os dados do cadastro.'},400);
 state=normalizeMyIDState(state).state;
 if(state.lessons.length>3000||state.attendance.length>5000)return json({error:'Limite de registros excedido.'},400);
 for(const lesson of state.lessons){if(!lesson.id||typeof lesson.title!=='string'||!lesson.title.trim()||lesson.title.length>200||!Number.isInteger(lesson.sequence)||lesson.sequence<1||!state.courses.some((c:any)=>c.id===lesson.courseId)||!Array.isArray(lesson.materialIds)||lesson.materialIds.length>100||lesson.date&&!validDate(lesson.date)||lesson.materialIds.some((id:string)=>!state.materials.some((m:any)=>m.id===id&&m.type==='pdf'&&m.courseId===lesson.courseId)))return json({error:'Verifique os dados da aula e os PDFs vinculados.'},400)}
 const attendanceKeys=new Set();
 for(const entry of state.attendance){const key=entry.courseId+'|'+entry.date;if(!entry.id||!state.courses.some((c:any)=>c.id===entry.courseId)||!validDate(entry.date)||attendanceKeys.has(key)||!['present','absent','justified'].includes(entry.status)||typeof entry.note!=='string'||entry.note.length>1000)return json({error:'Registro de presença inválido.'},400);attendanceKeys.add(key)}
 if(!['light','dark','system'].includes(state.settings.theme))return json({error:'Tema inválido.'},400);
 for(const c of state.courses){if(!c.id||typeof c.title!=='string'||c.title.length>150||!Array.isArray(c.scores)||c.scores.some((s:any)=>typeof s.value!=='number'||s.value<0||s.value>10||!Number.isFinite(s.value)||typeof s.label!=='string'))return json({error:'Curso ou notas inválidas.'},400)}
 for(const m of state.materials){if(typeof m.url!=='string'||!/^\/(?:materials\/|api\/myedi\/files\/)/.test(m.url)&&!(m.type==='video'&&/^[\w-]{11}$/.test(m.url)))return json({error:'Material inválido.'},400)}
 const result=await env.DB.prepare('UPDATE myedi_state SET document=?,revision=revision+1,updated_at=? WHERE owner_id=? AND revision=?').bind(JSON.stringify(state),new Date().toISOString(),owner,revision).run();
 if(!result.meta.changes)return json({error:'Os dados foram alterados em outra sessão. Recarregue antes de salvar.'},409);
 return json({revision:revision+1,updatedAt:new Date().toISOString()});
}
