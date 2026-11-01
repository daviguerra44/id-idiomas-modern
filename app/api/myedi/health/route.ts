import { env } from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(){try{if(!env.DB||!env.BUCKET)return Response.json({ready:false},{status:503});await env.DB.prepare('SELECT owner_id FROM myedi_state LIMIT 0').all();return Response.json({ready:true,database:true,files:true},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({ready:false},{status:503})}}
