import {getChatGPTUser} from '../../../chatgpt-auth';
export const dynamic='force-dynamic';
export async function POST(){
 if(!await getChatGPTUser())return Response.json({error:'Entre na sua conta.'},{status:401});
 return Response.json({error:'Os materiais oficiais são importados da sua própria conta MyID.'},{status:403});
}
