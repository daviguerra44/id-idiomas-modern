// Reads only the public institutional homepage; never requests MyID or a session.
import {publishedMyIDLinks} from './lib/myid-public-contract.mjs';
const source='https://id-idiomas.com.br/';
try{
 const response=await fetch(source,{redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Public homepage returned HTTP '+response.status);
 const html=await response.text();if(html.length>2000000)throw Error('Public homepage above size limit');
 const links=publishedMyIDLinks(html);
 console.log(JSON.stringify({checkedAt:new Date().toISOString(),source,status:response.status,publishedPortalLinks:links,publishedSecurePortalLinks:links.filter(url=>url.startsWith('https:')),cookiesOrCredentialsSent:false},null,2));
}catch(error){console.log(JSON.stringify({source,error:error.message}));process.exitCode=1;}
