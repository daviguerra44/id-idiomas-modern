// Sites authenticates and authorizes access to this private application. Live
// workspaces use the trusted per-Site user ID, never an email or a fixed student.
export function liveMyIDAccess(user:{userId:string;email:string}|null){
 if(!user?.userId||!user.email)return null;
 return {ownerId:'live:'+user.userId,canAdmin:false,canConnect:true};
}
