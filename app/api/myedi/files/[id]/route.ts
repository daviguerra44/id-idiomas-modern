import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../../chatgpt-auth';
import { liveMyIDAccess } from '../../../../live-myid-access';
import {accountContext} from '../../../../legacy/sync';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const access=liveMyIDAccess(await getChatGPTUser());if(!access)return new Response('Entre na sua conta.',{status:401});
 const {id}=await params;if(!/^[\da-f-]{36}$/i.test(id))return new Response('Arquivo inválido.',{status:400});
 let account;try{account=await accountContext(access.ownerId);}catch{return new Response('Conecte sua conta novamente.',{status:401});}
 if(!account)return new Response('Conecte sua conta MyID.',{status:401});
 const state=await env.DB?.prepare('SELECT document FROM myedi_state WHERE owner_id=?').bind(account.accountKey).first<{document:string}>();
 if(!state||!JSON.parse(state.document).materials?.some((m:any)=>!m.archived&&m.url==='/api/myedi/files/'+id))return new Response('Arquivo não encontrado.',{status:404});
 const file=await env.BUCKET?.get(account.accountKey+'/'+id);if(!file)return new Response('Arquivo não encontrado.',{status:404});
 const name=(file.customMetadata?.name||'material.pdf').replace(/[\r\n"\\]/g,'_');
 const ascii=name.replace(/[^\x20-\x7e]/g,'_');
 return new Response(file.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
