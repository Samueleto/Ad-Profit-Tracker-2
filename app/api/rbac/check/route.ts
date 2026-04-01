import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { SYSTEM_DEFAULTS, PERMISSION_KEYS } from '@/lib/rbac/systemDefaults';
import type { WorkspaceRole, PermissionKey } from '@/lib/rbac/systemDefaults';

const PERMISSION_KEY_SET = new Set<string>(PERMISSION_KEYS);

async function resolvePermissions(uid: string): Promise<{ role: WorkspaceRole; permissions: Record<string, boolean> } | null> {
  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists) return null;
  const data = userDoc.data()!;
  const role: WorkspaceRole = data.workspaceRole ?? (data.role === 'admin' ? 'owner' : 'member');
  // Owner always has all permissions
  if (role === 'owner') return { role, permissions: SYSTEM_DEFAULTS.owner };
  return { role, permissions: data.effectivePermissions ?? SYSTEM_DEFAULTS[role] };
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json().catch(() => ({}));
    const { permission, targetUid } = body as { permission?: string; targetUid?: string };

    // Validate permission key against allowlist
    if (!permission || !PERMISSION_KEY_SET.has(permission)) {
      return NextResponse.json(
        { error: `Invalid permission key. Allowed: ${PERMISSION_KEYS.join(', ')}` },
        { status: 400 }
      );
    }

    // Cross-user check: only owner or admin may check another user's permissions.
    // Don't leak whether a user exists via 404 vs 403 differences — always 403.
    if (targetUid && targetUid !== uid) {
      const actorResult = await resolvePermissions(uid);
      if (!actorResult) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (actorResult.role !== 'owner' && actorResult.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Actor is owner or admin — check the target user's permission
      const targetResult = await resolvePermissions(targetUid);
      if (!targetResult) {
        // Don't 404 — return 403 to avoid leaking user existence
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const allowed = !!targetResult.permissions[permission as PermissionKey];
      return NextResponse.json({
        permission,
        allowed,
        targetRole: targetResult.role,
      });
    }

    // Self-check
    const selfResult = await resolvePermissions(uid);
    if (!selfResult) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const allowed = !!selfResult.permissions[permission as PermissionKey];
    return NextResponse.json({
      permission,
      allowed,
      role: selfResult.role,
    });
  } catch (error) {
    console.error('POST /api/rbac/check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
