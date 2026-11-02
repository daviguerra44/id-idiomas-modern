import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {liveMyIDAccess} from '../../../live-myid-access';
import {accountContext,readResource} from '../../../legacy/sync';
import {emptyMyIDState} from '../../../myid-empty';
import {LegacyError} from '../../../legacy/protocol';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 const access=liveMyIDAccess(await getChatGPTUser());if(!access)return json({error:'Entre na sua conta.'},401);
 try{
  const account=await accountContext(access.ownerId);
  if(!account)return json({state:emptyMyIDState(),revision:0,canAdmin:false,canConnect:true,readOnly:false,connected:false});
  if(!env.DB)return json({error:'Banco de dados indisponível.'},503);
  let row=await env.DB.prepare('SELECT document,revision,updated_at FROM myedi_state WHERE owner_id=?').bind(account.accountKey).first<{document:string;revision:number;updated_at:string}>();
  if(row&&JSON.parse(row.document).connection?.profileParserVersion!==3){
   try{await readResource(access.ownerId,['profile']);row=await env.DB.prepare('SELECT document,revision,updated_at FROM myedi_state WHERE owner_id=?').bind(account.accountKey).first<{document:string;revision:number;updated_at:string}>();}
   catch(error){if(!(error instanceof LegacyError)||error.code!=='SYNC_BUSY')throw error;}
  }
  return json({state:row?JSON.parse(row.document):emptyMyIDState(),revision:row?.revision||0,updatedAt:row?.updated_at,canAdmin:false,canConnect:true,readOnly:false,connected:true});
 }catch(error){return failure(error);}
}
export async function PUT(request:Request){
 const access=liveMyIDAccess(await getChatGPTUser());if(!access)return json({error:'Entre na sua conta.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 try{
  const account=await accountContext(access.ownerId);if(!account)return json({error:'Conecte sua conta MyID antes de salvar.'},401);
  if(!env.DB)return json({error:'Banco de dados indisponível.'},503);
  const raw=await request.text();if(raw.length>2000000)return json({error:'Dados acima do limite.'},413);
  const payload=JSON.parse(raw);if(!payload||!Number.isInteger(payload.revision)||!payload.state)return json({error:'Dados inválidos.'},400);
  const row=await env.DB.prepare('SELECT document,revision FROM myedi_state WHERE owner_id=?').bind(account.accountKey).first<{document:string;revision:number}>();
  if(!row)return json({error:'A conta ainda não foi carregada.'},409);
  if(row.revision!==payload.revision)return json({error:'Os dados mudaram em outra sessão. Recarregue antes de salvar.'},409);
  const current=JSON.parse(row.document),next=payload.state;
  const mutable=new Set(['notebooks','completed','favorites','tasks','settings','attendance']);
  for(const key of new Set([...Object.keys(current),...Object.keys(next)]))if(!mutable.has(key)&&JSON.stringify(current[key])!==JSON.stringify(next[key]))return json({error:'Dados acadêmicos e cadastrais são consultados no MyID original.'},403);
  const courses=new Set(current.courses.map((c:any)=>c.id)),materials=new Set(current.materials.map((m:any)=>m.id));
  if(!Array.isArray(next.completed)||!Array.isArray(next.favorites)||[...next.completed,...next.favorites].some(id=>!materials.has(id))||next.completed.length>1000||next.favorites.length>1000)return json({error:'Material não vinculado à sua conta.'},400);
  if(!next.notebooks||Array.isArray(next.notebooks)||Object.entries(next.notebooks).some(([id,value])=>!materials.has(id)||typeof value!=='string'||value.length>12000))return json({error:'Anotações inválidas.'},400);
  if(!Array.isArray(next.tasks)||next.tasks.length>1000||next.tasks.some((t:any)=>typeof t.id!=='string'||typeof t.title!=='string'||t.title.length>200||t.courseId&&!courses.has(t.courseId)))return json({error:'Plano de estudos inválido.'},400);
  if(!Array.isArray(next.attendance)||next.attendance.length>5000||next.attendance.some((a:any)=>!courses.has(a.courseId)||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||!['present','absent','justified'].includes(a.status)||a.source!=='student'||typeof a.note!=='string'||a.note.length>1000))return json({error:'Registro pessoal de presença inválido.'},400);
  if(!next.settings||!['light','dark','system'].includes(next.settings.theme)||next.settings.defaultCourse&&!courses.has(next.settings.defaultCourse))return json({error:'Preferências inválidas.'},400);
  const updatedAt=new Date().toISOString();
  const result=await env.DB.prepare('UPDATE myedi_state SET document=?,revision=revision+1,updated_at=? WHERE owner_id=? AND revision=?').bind(JSON.stringify(next),updatedAt,account.accountKey,row.revision).run();
  if(!result.meta.changes)return json({error:'Os dados mudaram em outra sessão. Recarregue antes de salvar.'},409);
  return json({revision:row.revision+1,updatedAt});
 }catch(error){return failure(error);}
}
function failure(error:unknown){if(error instanceof LegacyError)return json({error:error.message,code:error.code},error.status);if(error instanceof SyntaxError)return json({error:'Dados inválidos.'},400);return json({error:'Não foi possível acessar os dados da sua conta.'},500);}
