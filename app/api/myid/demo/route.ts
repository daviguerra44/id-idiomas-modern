export const dynamic='force-dynamic';
export async function GET(){return Response.json({error:'O fluxo principal agora utiliza exclusivamente a própria conta MyID. A cópia demonstrativa foi retirada.'},{status:410,headers:{'Cache-Control':'private, no-store'}});}
