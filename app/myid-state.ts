export function normalizeMyIDState(input:any){
 const state=structuredClone(input);const before=JSON.stringify(state);
 state.lessons=Array.isArray(state.lessons)?state.lessons:[];
 state.attendance=Array.isArray(state.attendance)?state.attendance:[];
 state.settings=state.settings||{};state.settings.theme=state.settings.theme||'system';
 for(const material of state.materials||[]){
  if(material.id?.startsWith('practice-')||material.id?.startsWith('v-')){material.courseId='';material.lessonId='';material.category='community';}
 }
 state.schemaVersion=2;
 return {state,changed:before!==JSON.stringify(state)};
}
