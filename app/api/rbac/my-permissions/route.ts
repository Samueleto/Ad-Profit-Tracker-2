import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { SYSTEM_DEFAULTS, PERMISSION_KEYS } from '@/lib/rbac/systemDefaults';
import type { WorkspaceRole, PermissionMap } from '@/lib/rbac/systemDefaults';

// 5-minute in-memory cache keyed by uid — updated in background after a miss
const permissionsCache = new Map<string, { permissions: PermissionMap; role: WorkspaceRole; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    // Cache hit
    const cached = permissionsCache.get(uid);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json({
        workspaceRole: cached.role,
        permissions: cached.permissions,
        fromCache: true,
      });
    }

    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const data = userDoc.data()!;
    const workspaceRole: WorkspaceRole = data.workspaceRole ?? (data.role === 'admin' ? 'owner' : 'member');

    // Owner short-circuit: return all permissions as true without reading workspacePermissions
    if (workspaceRole === 'owner') {
      const ownerPermissions = SYSTEM_DEFAULTS.owner;
      permissionsCache.set(uid, { permissions: ownerPermissions, role: 'owner', expiresAt: Date.now() + CACHE_TTL_MS });
      return NextResponse.json({
        workspaceRole: 'owner',
        permissions: ownerPermissions,
      });
    }

    // Non-owner: use effectivePermissions from user doc (set server-side) or fall back to defaults
    const effectivePermissions: PermissionMap = data.effectivePermissions ?? SYSTEM_DEFAULTS[workspaceRole];

    // Update cache
    permissionsCache.set(uid, { permissions: effectivePermissions, role: workspaceRole, expiresAt: Date.now() + CACHE_TTL_MS });

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
