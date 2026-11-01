(()=>{'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false,paused=false;
async function request(action,fields={}){
 const r=await fetch('/api/myid/connection',{credentials:'same-origin',...(action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...fields})}:{})});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'Não foi possível consultar a conexão.');return data;
}
async function render(canAdmin){
 const host=document.querySelector('#edi-view');if(!host)return;
 if(!canAdmin){host.innerHTML='<div class="edi-empty"><p>A conexão é gerenciada pelo administrador.</p></div>';return;}
 host.innerHTML='<div class="edi-heading"><div><h1>Conexão com o MyID</h1><p>Seus cursos e PDFs, organizados por aula.</p></div></div><section class="edi-panel myid-connection" aria-busy="true"><p>Consultando conexão…</p></section>';
 try{const status=await request();if(document.querySelector('#edi-view')!==host)return;draw(host,status)}catch(error){host.querySelector('.myid-connection').innerHTML=`<p role="alert">${escape(error.message)}</p><button class="edi-btn" id="myid-connect-retry">Tentar novamente</button>`;host.querySelector('#myid-connect-retry').onclick=()=>render(canAdmin);}
}
function draw(host,status){
 const panel=host.querySelector('.myid-connection');if(!panel)return;panel.setAttribute('aria-busy','false');
 if(!status.configured){panel.innerHTML=`<span class="myid-connection-label">INTEGRAÇÃO EM PREPARAÇÃO</span><h2>A conexão com o portal original ainda não está disponível.</h2><p>${escape(status.reason)}</p><p>Seus dados e materiais atuais continuam disponíveis. Nenhum arquivo do portal original foi importado por essa conexão.</p><a class="edi-btn" href="#/my-id/cursos">Acessar meus cursos ↗</a>`;return;}
 if(!status.connected){panel.innerHTML='<span class="myid-connection-label">SUA CONTA ORIGINAL</span><h2>Traga suas aulas para cá!</h2><p>Use o mesmo usuário e senha do portal MyID. A senha será usada somente para entrar e não será salva.</p><form id="myid-original-login"><label>Usuário ou e-mail<input name="username" autocomplete="username" required maxlength="200"></label><label>Senha<input name="password" type="password" autocomplete="current-password" required maxlength="1000"></label><p id="myid-connection-message" role="status" aria-live="polite"></p><button class="edi-btn primary" type="submit">Conectar conta original</button></form>';panel.querySelector('form').onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;const form=event.target,button=form.querySelector('button'),message=panel.querySelector('#myid-connection-message');button.disabled=true;message.textContent='Conectando ao MyID…';const username=form.elements.username.value,password=form.elements.password.value;try{await request('connect',{username,password});if(panel.isConnected)draw(host,await request())}catch(error){message.textContent=error.message}finally{form.elements.password.value='';button.disabled=false;busy=false}};return;}
 panel.innerHTML=`<div class="myid-connection-heading"><div><span class="myid-connection-label">CONTA CONECTADA</span><h2>As aulas no lugar certo!</h2></div><span class="edi-status">Conectada</span></div><p>A importação consulta as matrículas da sua conta, organiza as aulas e salva os PDFs no novo MyID. Notas e documentos são apenas consultados no portal original.</p><div class="myid-sync-progress"><div><strong id="myid-progress-title">${status.pending?'Importação pausada':status.finishedAt?'Última importação concluída':'Pronto para importar'}</strong><span id="myid-progress-count"></span></div><progress id="myid-progress" max="${status.total||1}" value="${status.completed||0}"></progress><p id="myid-progress-detail" aria-live="polite"></p></div><div class="myid-sync-actions"><button class="edi-btn primary" id="myid-sync-start">${status.pending?'Continuar importação':'Sincronizar cursos e materiais'}</button><button class="edi-btn" id="myid-sync-pause" hidden>Pausar</button><button class="edi-btn" id="myid-sync-disconnect">Desconectar</button></div><p id="myid-connection-message" role="status" aria-live="polite"></p><div id="myid-sync-warnings"></div><a class="edi-text-btn" href="#/my-id/cursos">Ir para meus cursos ↗</a>`;
 paint(panel,status);
 panel.querySelector('#myid-sync-start').onclick=()=>run(host,panel,status.pending>0);
 panel.querySelector('#myid-sync-pause').onclick=()=>{paused=true;panel.querySelector('#myid-connection-message').textContent='Pausando após concluir o item atual…';};
 panel.querySelector('#myid-sync-disconnect').onclick=async()=>{if(busy)return;try{await request('disconnect');draw(host,await request())}catch(error){panel.querySelector('#myid-connection-message').textContent=error.message}};
}
function paint(panel,data){
 panel.querySelector('#myid-progress').max=data.total||1;panel.querySelector('#myid-progress').value=data.completed||0;
 panel.querySelector('#myid-progress-count').textContent=`${data.completed||0} de ${data.total||0} itens`;
 panel.querySelector('#myid-progress-detail').textContent=`${data.imported||0} PDFs importados${data.finishedAt?' · '+new Date(data.finishedAt).toLocaleString('pt-BR'):''}`;
 const warnings=panel.querySelector('#myid-sync-warnings');warnings.innerHTML=data.warnings?.length?`<details class="myid-sync-warning"><summary>${data.warnings.length} aviso(s) de importação</summary><ul>${data.warnings.map(w=>`<li>${escape(w)}</li>`).join('')}</ul></details>`:'';
}
async function run(host,panel,resume){
 if(busy)return;busy=true;paused=false;panel.querySelector('#myid-sync-start').disabled=true;panel.querySelector('#myid-sync-disconnect').disabled=true;panel.querySelector('#myid-sync-pause').hidden=false;
 const message=panel.querySelector('#myid-connection-message');message.textContent='Consultando suas aulas…';
 try{let data=resume?await request():await request('start');paint(panel,data);while(data.pending>0&&!paused&&panel.isConnected){panel.querySelector('#myid-progress-title').textContent='Importando aulas e documentos';data=await request('step');if(!panel.isConnected)break;paint(panel,data);await new Promise(resolve=>setTimeout(resolve,650));}window.MyID?.invalidate();if(panel.isConnected){draw(host,{...data,configured:true,connected:true});host.querySelector('#myid-connection-message').textContent=paused?'Importação pausada. Você pode continuar de onde parou.':data.pending>0?'Importação pausada.':'Importação concluída. Confira os cursos e os avisos.';}}
 catch(error){message.textContent=error.message;window.MyID?.invalidate();}
 finally{busy=false;if(panel.isConnected){panel.querySelector('#myid-sync-start').disabled=false;panel.querySelector('#myid-sync-disconnect').disabled=false;panel.querySelector('#myid-sync-pause').hidden=true;}}
}
window.MyIDConnection={render};
})();
