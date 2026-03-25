import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { SYSTEM_DEFAULTS } from '@/lib/rbac/systemDefaults';
import type { WorkspaceRole } from '@/features/rbac/types';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const data = userDoc.data()!;
    const workspaceRole: WorkspaceRole = data.workspaceRole ?? (data.role === 'admin' ? 'owner' : 'member');
    const effectivePermissions = data.effectivePermissions ?? SYSTEM_DEFAULTS[workspaceRole];

    return NextResponse.json({
      workspaceRole,
      permissions: effectivePermissions,
      isCustomized: !!data.effectivePermissions,
    });
  } catch (error) {
    console.error('rbac/my-permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
