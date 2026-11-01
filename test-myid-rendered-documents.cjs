const fs=require('fs'),vm=require('vm');
const bootstrap=fs.readFileSync('test-dashboard-ui.cjs','utf8').split('const tick=')[0];
const checks=`
(async()=>{await new Promise(r=>setImmediate(r));const api=window.MyID,c=api.getState().courses[0];
c.source='myid';c.officialGrade=7.24;c.reportCards=[{number:1,available:true,scores:c.scores,officialGrade:7.24,comment:'Feedback oficial'},{number:2,available:false,scores:[],officialGrade:null,comment:''}];
c.documents={evaluation:{blocks:[{type:'heading',text:'Evaluation'},{type:'text',text:'<script>injected()</script>Feedback'}],materialIds:[]},boleto:{blocks:[],materialIds:['invoice-test']},contract:{blocks:[{type:'text',text:'Contrato autorizado'}],materialIds:[]},'report-print-1':{blocks:[{type:'text',text:'Report Card 1 oficial'}],materialIds:[]}};
api.getState().materials.push({id:'invoice-test',courseId:c.id,title:'Boleto autorizado',type:'pdf',url:'/api/myedi/files/12345678-1234-1234-1234-123456789abc',category:'document'});
await api.render('boletim',c.id);assert.equal(document.querySelector('.edi-report-average strong').textContent,'7,24');assert(document.querySelector('.edi-report-average').classList.contains('tone-yellow'));assert(document.querySelector('[href="#/my-id/documentos/'+c.id+'"]'));assert(document.querySelector('#edi-report-number'));
document.querySelector('#edi-report-number').onchange({target:{value:'2'}});await new Promise(r=>setImmediate(r));assert(!document.querySelector('.edi-report-average'));assert(document.querySelector('.edi-empty'));
await api.render('avaliacoes',c.id);assert(document.querySelector('#edi-view').textContent.includes('Feedback'));assert(!document.querySelector('#edi-view script'));assert(!document.querySelector('.edi-report-table'));
await api.render('boletos',c.id);assert(document.querySelector('[href="#/my-id/material/invoice-test"]'));assert(document.querySelector('a[download]'));assert(!document.querySelector('#edi-view').textContent.includes('Contrato autorizado'));
await api.render('contrato',c.id);assert(document.querySelector('#edi-view').textContent.includes('Contrato autorizado'));
await api.render('documentos','missing');assert(document.querySelector('.edi-empty'));
c.scores=[];await api.render('inicio');assert(document.querySelector('.edi-performance'));assert(document.querySelector('.edi-performance').textContent.includes('7,24'));
console.log('Rendered integration bindings passed: official weighted grade, separate unavailable report, Evaluation without report-card mixup, escaped HTML, scoped PDF links, contract and grade-only overview.');
})().catch(e=>{console.error(e);process.exitCode=1});`;
vm.runInNewContext(bootstrap+checks,{require,console,process,URL,URLSearchParams,Blob,File,structuredClone,setImmediate},{filename:'integration-render-bindings'});
