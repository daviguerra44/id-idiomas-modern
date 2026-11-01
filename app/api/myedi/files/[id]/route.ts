import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../../chatgpt-auth';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();if(!user)return new Response('Entre na sua conta.',{status:401});
 const {id}=await params;if(!/^[\da-f-]{36}$/i.test(id))return new Response('Arquivo inválido.',{status:400});
 const file=await env.BUCKET?.get(user.userId+'/'+id);if(!file)return new Response('Arquivo não encontrado.',{status:404});
 return new Response(file.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${file.customMetadata?.name||'material.pdf'}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
