import seed from '../site/seed.json';

// Immutable copy of the account information already supplied and authorized by
// the owner. No live login, inferred lesson titles or invented academic records.
export function capturedMyIDDemo(){
 const state:any=structuredClone(seed);
 state.materials=state.materials.filter((m:any)=>m.type==='pdf'&&m.url.startsWith('/materials/')).map((m:any)=>({...m,category:'general',source:'id-public',courseId:'',lessonId:''}));
 state.completed=[];state.favorites=[];state.tasks=[];state.lessons=[];state.attendance=[];state.notebooks={};
 for(const course of state.courses){
  course.source='captured';course.documents={};
  if(course.id==='turma')course.reportCards=[{number:1,available:true,scores:structuredClone(course.scores),officialGrade:course.officialGrade,comment:course.comment},{number:2,available:false,scores:[],officialGrade:null,comment:''}];
  else course.reportCards=[];
 }
 state.demo={mode:'captured',capturedAt:'2026-11-01',live:false,profile:true,enrollments:3,reportCards:1,publicPDFs:state.materials.length,lessonPDFs:false,evaluation:false,financial:false,contracts:false,attendance:false};
 return state;
}
