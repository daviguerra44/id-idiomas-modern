(()=>{'use strict';
let busy=false,generation=0;
const get=s=>document.querySelector(s);
async function request(action,values={}){
 const response=await fetch('/api/myid/connection',{credentials:'same-origin',...(action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...values})}:{})});
 let data;try{data=await response.json()}catch{throw new Error('Não foi possível consultar o MyID. Tente novamente.')}
 if(!response.ok){const error=new Error(data.error||'Não foi possível entrar no MyID.');error.status=response.status;throw error;}return data;
}
function controls(){const form=get('#myid-entry-form');if(!form)return;form.querySelectorAll('input,button').forEach(el=>{el.disabled=busy});}
function message(text,error=false){const node=get('#myid-entry-status');if(node){node.textContent=text;node.setAttribute('role',error?'alert':'status');}}
function clearPassword(){const input=get('#myid-entry-password');if(input){input.value='';input.type='password'}const toggle=get('#myid-password-toggle');if(toggle){toggle.setAttribute('aria-pressed','false');toggle.setAttribute('aria-label','Mostrar senha');toggle.textContent='Mostrar';}}
async function refresh(){
 const ticket=++generation;controls();clearPassword();get('#myid-entry-form').hidden=false;get('#myid-entry-connected').hidden=true;
 get('#myid-entry-submit').textContent='Entrar com minha conta ID';message('Verificando conexão com o portal original…');
 try{const status=await request();if(ticket!==generation)return;
  if(!status.configured){message(status.reason+' Ao confirmar, verificaremos a conexão novamente.');return;}
  if(status.connected){get('#myid-entry-form').hidden=true;get('#myid-entry-connected').hidden=false;message('Sua conta original está conectada. Acesse a importação de cursos e materiais.');return;}
  controls();message('Use o mesmo usuário e senha do portal MyID. Sua senha não será salva.');
 }catch(error){if(ticket!==generation)return;message(error.status===403?'Sua conta não tem permissão para acessar esta página.':error.status===401?'Entre na conta autorizada para acessar esta prévia.':error.message);}
}
function openConnected(){const dialog=get('#login-dialog');dialog.close();window.MyID?.invalidate();location.hash='#/my-id/conexao';}
function init(){
 const form=get('#myid-entry-form'),dialog=get('#login-dialog');if(!form||!dialog)return;
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;const username=get('#myid-entry-username').value.trim(),password=get('#myid-entry-password').value;if(!username||!password){message('Informe seu usuário e sua senha.',true);return;}
  const ticket=generation;busy=true;controls();message('Verificando conexão segura…');get('#myid-entry-submit').textContent='Verificando…';
  try{const status=await request();if(ticket!==generation||!dialog.hasAttribute('open'))return;
   if(!status.configured)throw new Error('Não foi possível entrar: '+status.reason+' Sua senha não foi enviada.');
   if(status.connected){openConnected();return;}
   message('Autenticando no portal original…');get('#myid-entry-submit').textContent='Entrando…';
   await request('connect',{username,password});clearPassword();if(ticket===generation&&dialog.hasAttribute('open'))openConnected();}
  catch(error){if(ticket===generation)message(error.message,true);}
  finally{busy=false;clearPassword();controls();get('#myid-entry-submit').textContent='Entrar com minha conta ID';if(ticket!==generation&&dialog.hasAttribute('open'))refresh();}
 };
 get('#myid-password-toggle').onclick=()=>{const input=get('#myid-entry-password'),toggle=get('#myid-password-toggle'),show=input.type==='password';input.type=show?'text':'password';toggle.textContent=show?'Ocultar':'Mostrar';toggle.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');toggle.setAttribute('aria-pressed',String(show));};
 get('#myid-entry-continue').onclick=openConnected;
 dialog.addEventListener('close',()=>{generation++;controls();clearPassword();});
 if(location.hash==='#/entrar')refresh();
}
window.MyIDLogin={refresh};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
