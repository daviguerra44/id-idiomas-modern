import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import seed from '../../../../site/seed.json';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function identity(){ const user=await getChatGPTUser(); return user?.userId; }
export async function GET(){
 const owner=await identity();if(!owner)return json({error:'Entre na sua conta para acessar o MyEDI.'},401);
 if(!env.DB)return json({error:'Banco de dados indisponível.'},503);
 await env.DB.prepare('INSERT OR IGNORE INTO myedi_state (owner_id,document,revision,updated_at) VALUES (?,?,0,?)').bind(owner,JSON.stringify(seed),new Date().toISOString()).run();
 const row=await env.DB.prepare('SELECT document,revision,updated_at FROM myedi_state WHERE owner_id=?').bind(owner).first<{document:string,revision:number,updated_at:string}>();
 return json({state:JSON.parse(row!.document),revision:row!.revision,updatedAt:row!.updated_at,canAdmin:true});
}
export async function PUT(request:Request){
 const owner=await identity();if(!owner)return json({error:'Sessão expirada. Entre novamente.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 if(!env.DB)return json({error:'Banco indisponível.'},503);
 const raw=await request.text();if(raw.length>2000000)return json({error:'Dados acima do limite.'},413);
 let payload;try{payload=JSON.parse(raw)}catch{return json({error:'Dados inválidos.'},400)}
 const {state,revision}=payload;
 if(!state||!state.profile||typeof state.profile.name!=='string'||!state.profile.name.trim()||state.profile.name.length>100||!Number.isInteger(revision)||!Array.isArray(state.courses)||!Array.isArray(state.teachers)||!Array.isArray(state.materials)||!Array.isArray(state.tasks)||state.courses.length>300||state.teachers.length>300||state.materials.length>1000||state.tasks.length>1000)return json({error:'Verifique os dados do cadastro.'},400);
 for(const c of state.courses){if(!c.id||typeof c.title!=='string'||c.title.length>150||!Array.isArray(c.scores)||c.scores.some((s:any)=>typeof s.value!=='number'||s.value<0||s.value>10||!Number.isFinite(s.value)||typeof s.label!=='string'))return json({error:'Curso ou notas inválidas.'},400)}
 for(const m of state.materials){if(typeof m.url!=='string'||!/^\/(?:materials\/|api\/myedi\/files\/)/.test(m.url)&&!(m.type==='video'&&/^[\w-]{11}$/.test(m.url)))return json({error:'Material inválido.'},400)}
 const result=await env.DB.prepare('UPDATE myedi_state SET document=?,revision=revision+1,updated_at=? WHERE owner_id=? AND revision=?').bind(JSON.stringify(state),new Date().toISOString(),owner,revision).run();
 if(!result.meta.changes)return json({error:'Os dados foram alterados em outra sessão. Recarregue antes de salvar.'},409);
 return json({revision:revision+1,updatedAt:new Date().toISOString()});
}
