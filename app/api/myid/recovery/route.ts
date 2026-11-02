import {getChatGPTUser} from '../../../chatgpt-auth';
import {recoverPassword} from '../../../legacy/sync';
import {LegacyError} from '../../../legacy/protocol';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 if(!await getChatGPTUser())return json({error:'Entre na conta autorizada da prévia.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 try{const raw=await request.text();if(raw.length>5000)return json({error:'Dados acima do limite.'},413);const body=JSON.parse(raw);if(typeof body?.username!=='string'||!body.username.trim()||body.username.length>200)return json({error:'Informe seu usuário ou e-mail.'},400);return json(await recoverPassword(body.username.trim()));}
 catch(error){return error instanceof LegacyError?json({error:error.message,code:error.code},error.status):json({error:'Não foi possível solicitar a recuperação de senha.'},500);}
}
