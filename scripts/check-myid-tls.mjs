// Transport-only diagnostic: no HTTP request, credentials or cookies are sent.
import tls from 'node:tls';
const host='my.id-idiomas.com.br';
const socket=tls.connect({host,port:443,servername:host,rejectUnauthorized:true});
let finished=false;
const finish=(result,success)=>{if(finished)return;finished=true;socket.destroy();console.log(JSON.stringify({host,port:443,checkedAt:new Date().toISOString(),...result}));process.exitCode=success?0:1;};
socket.setTimeout(10000,()=>finish({tlsValid:false,code:'TIMEOUT',reason:'A conexão TLS não foi concluída em dez segundos.'},false));
socket.once('secureConnect',()=>{const cert=socket.getPeerCertificate();finish({tlsValid:socket.authorized,protocol:socket.getProtocol(),certificateSubject:cert.subject?.CN,validTo:cert.valid_to},socket.authorized);});
socket.once('error',error=>finish({tlsValid:false,code:error.code||'TLS_ERROR',reason:error.message},false));
