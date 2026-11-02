(()=>{'use strict';
let busy=false,generation=0;
const get=s=>document.querySelector(s);
async function request(action,values={}){
 for(let attempt=0;;attempt++){
  const response=await fetch('/api/myid/connection',{credentials:'same-origin',...(action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...values})}:{})});
  const data=await response.json();if(response.ok)return data;
  if(data.code==='SYNC_BUSY'&&attempt<8){await new Promise(resolve=>setTimeout(resolve,700+attempt*150));continue;}
  throw new Error(data.error||'Não foi possível entrar. Tente novamente.');
 }
}
function message(text,error=false){const node=get('#myid-entry-status');node.textContent=text;node.setAttribute('role',error?'alert':'status');}
function clearPassword(){const input=get('#myid-entry-password');input.value='';input.type='password';get('#myid-password-toggle').textContent='Mostrar';get('#myid-password-toggle').setAttribute('aria-pressed','false');}
function loginView(){get('#myid-entry-form').hidden=false;get('#myid-recovery-form').hidden=true;get('#myid-entry-heading').textContent='Entre no MyID';message('');}
function enter(changed=false){const dialog=get('#login-dialog');if(dialog.hasAttribute('open'))dialog.close();window.MyID?.invalidate();if(changed)window.MyIDAuto?.accountChanged();else window.MyIDAuto?.start();location.hash='#/my-id';}
async function open(force=false){
 if(busy)return;const ticket=++generation;clearPassword();loginView();
 try{const status=await request();if(ticket!==generation)return;if(status.connected&&!force){enter();return;}if(!status.configured)message(status.reason,true);}
 catch(error){if(ticket!==generation)return;message(error.message,true);}
 if(!get('#login-dialog').hasAttribute('open'))get('#login-dialog').showModal();
}
function init(){
 const dialog=get('#login-dialog'),form=get('#myid-entry-form');if(!dialog||!form)return;
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;const username=get('#myid-entry-username').value.trim(),password=get('#myid-entry-password').value;if(!username||!password){message('Informe seu usuário e sua senha.',true);return;}
  const ticket=generation,button=get('#myid-entry-submit');busy=true;button.disabled=true;button.textContent='Entrando…';message('');
  try{const status=await request();if(!status.configured)throw new Error(status.reason+' Sua senha não foi enviada.');await request('connect',{username,password});if(ticket===generation&&dialog.hasAttribute('open'))enter(true);}
  catch(error){if(ticket===generation)message(error.message,true);}
  finally{busy=false;clearPassword();button.disabled=false;button.textContent='Entrar';}
 };
 get('#myid-password-toggle').onclick=()=>{const input=get('#myid-entry-password'),show=input.type==='password';input.type=show?'text':'password';get('#myid-password-toggle').textContent=show?'Ocultar':'Mostrar';get('#myid-password-toggle').setAttribute('aria-pressed',String(show));};
 get('#myid-forgot').onclick=()=>{clearPassword();get('#myid-entry-form').hidden=true;get('#myid-recovery-form').hidden=false;get('#myid-entry-heading').textContent='Recuperar senha';get('#myid-recovery-username').value=get('#myid-entry-username').value;message('');};
 get('#myid-back-login').onclick=loginView;
 get('#myid-recovery-form').onsubmit=async event=>{event.preventDefault();if(busy)return;const username=get('#myid-recovery-username').value.trim();if(!username){message('Informe seu usuário ou e-mail.',true);return;}const button=event.target.querySelector('[type="submit"]');busy=true;button.disabled=true;message('Enviando…');
  try{const r=await fetch('/api/myid/recovery',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})}),data=await r.json();if(!r.ok)throw new Error(data.error||'Não foi possível enviar.');message(data.message);}
  catch(error){message(error.message,true);}finally{busy=false;button.disabled=false;}
 };
 dialog.addEventListener('close',()=>{generation++;clearPassword();});if(location.hash==='#/entrar')void open();
}
window.MyIDLogin={open,refresh:open};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
