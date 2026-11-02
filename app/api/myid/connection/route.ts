import { getChatGPTUser } from '../../../chatgpt-auth';
import { liveMyIDAccess } from '../../../live-myid-access';
import { LegacyError } from '../../../legacy/protocol';
import { status,connect,start,step,disconnect,inspectConnection } from '../../../legacy/sync';
export const dynamic='force-dynamic';
const json=(value:unknown,code=200)=>Response.json(value,{status:code,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request?:Request){
  const access=liveMyIDAccess(await getChatGPTUser());if(!access)return json({error:'Entre na sua conta.'},401);
  try{
    if(request&&new URL(request.url).searchParams.get('probe')==='1')return json(await inspectConnection());
    return json(await status(access.ownerId));
  }catch(error){return failure(error);}
}
export async function POST(request:Request){
  const access=liveMyIDAccess(await getChatGPTUser());if(!access)return json({error:'Entre na sua conta.'},401);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Formato inválido.'},415);
  try{
    const text=await request.text();if(text.length>16000)return json({error:'Dados acima do limite.'},413);
    const payload=JSON.parse(text);if(!payload||typeof payload!=='object'||Array.isArray(payload))return json({error:'Dados inválidos.'},400);
    if(payload.action==='connect'){
      if(typeof payload.username!=='string'||!payload.username.trim()||payload.username.length>200||typeof payload.password!=='string'||!payload.password||payload.password.length>1000)return json({error:'Informe usuário e senha.'},400);
      return json(await connect(access.ownerId,payload.username.trim(),payload.password));
    }
    if(payload.action==='start')return json(await start(access.ownerId));
    if(payload.action==='step')return json(await step(access.ownerId));
    if(payload.action==='disconnect')return json(await disconnect(access.ownerId));
    return json({error:'Ação inválida.'},400);
  }catch(error){return failure(error);}
}
function failure(error:unknown){
  if(error instanceof LegacyError)return json({error:error.message,code:error.code},error.status);
  if(error instanceof SyntaxError)return json({error:'Dados inválidos.'},400);
  return json({error:'A integração encontrou um erro. Seus dados existentes foram preservados.',code:'INTEGRATION_ERROR'},500);
}
