import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Entre na sua conta.'},{status:401});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
 if(!env.BUCKET)return Response.json({error:'Armazenamento indisponível.'},{status:503});
 const form=await request.formData(),file=form.get('file');if(!(file instanceof File)||file.type!=='application/pdf'||file.size>20*1024*1024||file.size<5)return Response.json({error:'Envie um PDF de até 20 MB.'},{status:400});
 const bytes=await file.arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')return Response.json({error:'O arquivo não é um PDF válido.'},{status:400});
 const id=crypto.randomUUID();const name=file.name.replace(/[\r\n"\\]/g,'_').slice(0,120);
 await env.BUCKET.put(user.userId+'/'+id,bytes,{httpMetadata:{contentType:'application/pdf'},customMetadata:{name}});
 return Response.json({id,url:'/api/myedi/files/'+id,name,size:file.size});
}
