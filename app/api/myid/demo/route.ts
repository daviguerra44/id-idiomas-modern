import {getChatGPTUser} from '../../../chatgpt-auth';
import {myIDAccess} from '../../../myid-access';
import {capturedMyIDDemo} from '../../../myid-demo';
export const dynamic='force-dynamic';
export async function GET(){
 const access=myIDAccess(await getChatGPTUser());
 if(!access)return Response.json({error:'Entre com uma conta autorizada para acessar a demonstração.'},{status:401,headers:{'Cache-Control':'private, no-store'}});
 return Response.json({state:capturedMyIDDemo(),revision:0,canAdmin:false,readOnly:true,mode:'captured-demo'},{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
