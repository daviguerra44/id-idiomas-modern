(()=>{'use strict';
let running=false,timer=null,generation=0,forceNext=false,lastRefresh=0,pausedUntil=0,interactiveCount=0;
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('myid-account-updates'):null;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(action){
 for(let attempt=0;;attempt++){
  const response=await fetch('/api/myid/connection',{credentials:'same-origin',...(action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})}:{})});
  const data=await response.json();if(response.ok)return data;
  if(data.code==='SYNC_BUSY'&&attempt<8){await delay(700+attempt*150);continue;}
  const error=new Error(data.error||'Não foi possível atualizar o MyID.');error.code=data.code;error.status=response.status;throw error;
 }
}
function schedule(ms=60000){clearTimeout(timer);timer=setTimeout(()=>start(),ms);}
async function changed(broadcast=true){
 if(Date.now()-lastRefresh<2000)return;lastRefresh=Date.now();
 try{await window.MyID?.refreshData?.()}catch{}
 if(broadcast)channel?.postMessage({type:'data'});
}
function progress(data){window.dispatchEvent(new CustomEvent('myid-autosync',{detail:{...data,configured:true,connected:true}}));}
async function run(ticket){
 const status=await request();if(ticket!==generation||!status.configured||!status.connected)return;
 const force=forceNext;forceNext=false;let data=await request(force?'start':'ensure');progress(data);let count=0;
 while(data.pending>0&&ticket===generation){
  data=await request('step');if(ticket!==generation)return;progress(data);
  if(++count%3===0)await changed();await delay(350);
 }
 if(ticket===generation){lastRefresh=0;await changed();}
}
async function start(force=false){
 forceNext=forceNext||force;if(interactiveCount||Date.now()<pausedUntil){schedule(Math.max(1000,pausedUntil-Date.now()));return;}if(running)return;running=true;const ticket=generation;let acquired=true;
 try{
  if(navigator.locks?.request)await navigator.locks.request('myid-background-update',{ifAvailable:true},async lock=>{if(!lock){acquired=false;return}await run(ticket)});
  else await run(ticket);
 }catch(error){
  if(ticket===generation&&error.status===401){lastRefresh=0;await changed();}
 }finally{running=false;schedule(ticket!==generation?0:forceNext?1000:acquired?60000:10000);}
}
function pause(until){generation++;pausedUntil=Math.max(pausedUntil,until);clearTimeout(timer);schedule(Math.max(1000,pausedUntil-Date.now()));}
async function interactive(task){
 interactiveCount++;const until=Date.now()+120000;pause(until);channel?.postMessage({type:'pause',until});
 try{return navigator.locks?.request?await navigator.locks.request('myid-background-update',{},()=>task()):await task();}
 finally{interactiveCount--;if(!interactiveCount){pausedUntil=0;channel?.postMessage({type:'resume'});schedule(1000);}}
}
function accountChanged(broadcast=true){
 generation++;forceNext=false;clearTimeout(timer);lastRefresh=0;window.MyID?.clear?.();
 if(broadcast)channel?.postMessage({type:'account'});
 if(!running)void start();else schedule(1000);
}
if(channel)channel.onmessage=event=>{if(event.data?.type==='pause')pause(Math.min(Date.now()+120000,Number(event.data.until)||Date.now()));else if(event.data?.type==='resume'){pausedUntil=0;schedule(1000);}else if(event.data?.type==='data')void changed(false);else if(event.data?.type==='account'){accountChanged(false);if(location.hash.startsWith('#/my-id')){location.hash='#/my-id';void window.MyID?.render?.('inicio')}}};
window.MyIDAuto={start,accountChanged,interactive};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start());else void start();
})();
