const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let pending=2,steps=0,refreshes=0,clears=0,lockAvailable=true,calls=[],events=[],messages=[];
class Channel{postMessage(message){messages.push(message)}}
const window={MyID:{refreshData:async()=>refreshes++,clear:()=>clears++},dispatchEvent:e=>events.push(e.detail)};
const context={window,document:{readyState:'loading',addEventListener(){}},location:{hash:'#/my-id'},navigator:{locks:{request:async(name,options,fn)=>fn(lockAvailable?{}:null)}},BroadcastChannel:Channel,CustomEvent:class{constructor(name,options){this.detail=options.detail}},Date,console,clearTimeout(){},setTimeout(fn,ms){if(ms<1000)queueMicrotask(fn);return 1},fetch:async(url,options={})=>{const action=options.body?JSON.parse(options.body).action:'status';calls.push(action);if(action==='step'){steps++;pending--;}return {ok:true,json:async()=>action==='status'?{configured:true,connected:true}:{pending,completed:steps,total:2,imported:steps}}}};
vm.runInNewContext(fs.readFileSync('public/myid-auto.js','utf8'),context);
(async()=>{
 await window.MyIDAuto.start();assert.equal(calls[0],'status');assert.equal(calls[1],'ensure');assert.equal(steps,2);assert(refreshes>0);assert(events.some(e=>e.pending===0));
 const before=steps;await window.MyIDAuto.start();assert.equal(steps,before,'Finished catalog must not trigger step requests');
 calls=[];lockAvailable=false;await window.MyIDAuto.start();assert.equal(calls.length,0,'Another tab holding the lock must not start duplicate work');
 window.MyIDAuto.accountChanged();assert.equal(clears,1);assert(messages.some(m=>m.type==='account'));assert(!JSON.stringify(messages).includes('password'));
 console.log('Automatic client passed: starts without a sync click, continues work, refreshes views, skips completed work, coordinates tabs and clears account state. Requests intercepted for this test only.');
})().catch(error=>{console.error(error);process.exitCode=1});
