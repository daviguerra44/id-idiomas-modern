import {getChatGPTUser} from '../../../chatgpt-auth';
import {liveMyIDAccess} from '../../../live-myid-access';
import {originalAvatar,uploadOriginalAvatar} from '../../../legacy/sync';
import {LegacyError,boundedBody} from '../../../legacy/protocol';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
function failure(error:unknown){return error instanceof LegacyError?json({error:error.message,code:error.code},error.status):json({error:'Não foi possível atualizar a foto no portal original.'},500);}
export async function GET(){const access=liveMyIDAccess(await getChatGPTUser());if(!access)return json({error:'Entre na sua conta.'},401);try{return await originalAvatar(access.ownerId);}catch(error){return failure(error);}}
export async function POST(request:Request){
 const access=liveMyIDAccess(await getChatGPTUser());if(!access)return json({error:'Entre na sua conta.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 if(Number(request.headers.get('content-length'))>6*1024*1024)return json({error:'Imagem acima do limite.'},413);
 try{const bytes=await boundedBody(new Response(request.body,{headers:request.headers}),6*1024*1024),form=await new Response(bytes,{headers:request.headers}).formData(),file=form.get('image');if(!(file instanceof File))return json({error:'Selecione uma imagem.'},400);return json(await uploadOriginalAvatar(access.ownerId,file));}catch(error){return failure(error);}
}
