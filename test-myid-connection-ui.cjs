const fs=require('fs'),assert=require('assert/strict'),vm=require('vm'),{parseHTML}=require('linkedom');
const {document}=parseHTML('<html><body><div id="edi-view"></div></body></html>');let cleared=0;const location={hash:""};let data={configured:false,reason:'Aguardando conexão HTTPS.'},calls=[],steps=0,invalidated=0;
const window={addEventListener(){},MyID:{invalidate(){invalidated++},clear(){cleared++}}},ctx=vm.createContext({document,window,location,console,setTimeout:resolve=>resolve(),fetch:async(url,options={})=>{const action=options.body?JSON.parse(options.body).action:null;calls.push(action);if(action==='start')data={configured:true,connected:true,total:2,completed:0,pending:2,imported:0,warnings:[]};if(action==='step'){steps++;data={...data,completed:steps,pending:2-steps,imported:steps};}if(action==='disconnect')data={configured:true,connected:false};return {ok:true,json:async()=>structuredClone(data)}}});
vm.runInContext(fs.readFileSync('public/myid-connection.js','utf8'),ctx);
(async()=>{
 await window.MyIDConnection.render(true);assert(!document.querySelector('input[type=password]'));assert(document.querySelector('.myid-connection').textContent.includes('HTTPS'));
 await window.MyIDConnection.render(false);assert.equal(calls.length,1,'Viewer must not request owner session status');
 data={configured:true,connected:true,total:0,completed:0,pending:0,imported:0,warnings:[]};await window.MyIDConnection.render(true);await document.querySelector('#myid-sync-start').onclick();assert.equal(steps,2);assert.equal(invalidated,1);assert(document.querySelector('#myid-connection-message').textContent.includes('concluída'));assert.equal(Number(document.querySelector('#myid-progress').getAttribute('value')||document.querySelector('#myid-progress').value),2);
 await document.querySelector('#myid-sync-disconnect').onclick();assert.equal(cleared,1);assert.equal(location.hash,'#/entrar');
 console.log('Connection UI passed: pending configuration collects no credentials, viewer cannot inspect connection, sequential progress completes and disconnect clears cached state and returns to login.');
})().catch(e=>{console.error(e);process.exitCode=1});
