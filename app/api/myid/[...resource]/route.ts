import {getChatGPTUser} from '../../../chatgpt-auth';
import {liveMyIDAccess} from '../../../live-myid-access';
import {readResource} from '../../../legacy/sync';
import {LegacyError} from '../../../legacy/protocol';
export const dynamic='force-dynamic';
const failure=(error:string,status:number,code?:string)=>Response.json({error,...(code?{code}:{})},{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request,{params}:{params:Promise<{resource:string[]}>}){
  const access=liveMyIDAccess(await getChatGPTUser());if(!access)return failure('Entre na sua conta.',401);
  if(request.headers.get('sec-fetch-site')==='cross-site'&&request.headers.get('sec-fetch-mode')!=='navigate')return failure('Origem inválida.',403);
  const {resource}=await params;
  if(!Array.isArray(resource)||resource.length>4||resource.some(s=>!s||s.length>120||!/^[\w-]+$/.test(s))||new URL(request.url).search)return failure('Consulta inválida.',400);
  try{return await readResource(access.ownerId,resource);}catch(error){
    if(error instanceof LegacyError)return failure(error.message,error.status,error.code);
    return failure('Não foi possível consultar o MyID original.',500,'INTEGRATION_ERROR');
  }
}
