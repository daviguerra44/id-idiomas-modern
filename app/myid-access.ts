// Shared academic record for this private preview. Keep this policy server-side.
export const MYID_RECORD_OWNER = 'BYPn8LAQcSPF6W0VdJPjQgczciTSHg4HVgc61mu4578B7J22va8iAP';
const OWNER_EMAIL = 'daviguerraestevez44@gmail.com';
const VIEWER_EMAIL = 'jpgestevez@gmail.com';

export function myIDAccess(user: { userId: string; email: string } | null) {
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  const canAdmin = user.userId === MYID_RECORD_OWNER && email === OWNER_EMAIL;
  if (!canAdmin && email !== VIEWER_EMAIL) return null;
  return { ownerId: MYID_RECORD_OWNER, canAdmin, readOnly: !canAdmin };
}
