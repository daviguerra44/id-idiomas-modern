import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../../chatgpt-auth';
import { myIDAccess } from '../../../../myid-access';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const access=myIDAccess(await getChatGPTUser());if(!access)return new Response('Entre na sua conta.',{status:401});
 const {id}=await params;if(!/^[\da-f-]{36}$/i.test(id))return new Response('Arquivo inválido.',{status:400});
 const file=await env.BUCKET?.get(access.ownerId+'/'+id);if(!file)return new Response('Arquivo não encontrado.',{status:404});
 const name=(file.customMetadata?.name||'material.pdf').replace(/[\r\n"\\]/g,'_');
 const ascii=name.replace(/[^\x20-\x7e]/g,'_');
 return new Response(file.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
