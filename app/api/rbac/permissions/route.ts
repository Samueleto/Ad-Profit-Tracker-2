import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { SYSTEM_DEFAULTS, PERMISSION_KEYS, EDITABLE_ROLES } from '@/lib/rbac/systemDefaults';
import type { WorkspaceRole, PermissionMap, PermissionKey } from '@/lib/rbac/systemDefaults';

// Rate limit: 20 permission updates/hour per uid
const permUpdateRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkPermUpdateRateLimit(uid: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = permUpdateRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    permUpdateRateLimit.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

// Role hierarchy: which roles an actor can edit
const CAN_EDIT: Record<WorkspaceRole, WorkspaceRole[]> = {
  owner: ['admin', 'member', 'viewer', 'analyst'],
  admin: ['member', 'viewer'],
  member: [],
  viewer: [],
  analyst: [],
};

const PERMISSION_KEY_SET = new Set<string>(PERMISSION_KEYS);

// ─── GET /api/rbac/permissions ──────────────────────────────────────────────
// Returns the workspace permission matrix. Any authenticated workspace member
// can read (members need to understand what roles can do).
// workspaceId is derived from the verified uid's users document — never from the request.

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found. No workspace associated.' }, { status: 404 });
    }
    const workspaceId = userDoc.data()?.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace associated with this account.' }, { status: 404 });
    }

    // Read workspace permission matrix from workspacePermissions collection
    const wpDoc = await adminDb.collection('workspacePermissions').doc(workspaceId).get();
    const isCustomized = wpDoc.exists;
    const matrix = isCustomized
      ? (wpDoc.data()?.permissions ?? SYSTEM_DEFAULTS)
      : SYSTEM_DEFAULTS;

    // Determine which roles have been customized from system defaults
    const customizedRoles: string[] = isCustomized
      ? EDITABLE_ROLES.filter((role) => {
          const custom = (matrix as Record<string, unknown>)[role];
          const def = (SYSTEM_DEFAULTS as Record<string, unknown>)[role];
          return JSON.stringify(custom) !== JSON.stringify(def);
        })
      : [];

    return NextResponse.json({
      workspaceId,
      permissions: matrix,
      // Aliases expected by useRolePermissions hook
      rolePermissions: matrix,
      customizedRoles,
    });
  } catch (error) {
    console.error('GET /api/rbac/permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/rbac/permissions ────────────────────────────────────────────
// Updates permissions for a specific role. Enforces hierarchy strictly.

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const rl = checkPermUpdateRateLimit(uid);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many permission updates. Maximum 20 per hour.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } }
    );
  }

  try {
    const body = await request.json();
    const { role, permissions } = body as { role: string; permissions: Record<string, unknown> };

    // Owner permissions are immutable — block immediately
    if (role === 'owner') {
      return NextResponse.json(
        { error: 'Owner permissions are immutable and cannot be edited.' },
        { status: 400 }
      );
    }

    // Validate target role
    if (!EDITABLE_ROLES.includes(role as WorkspaceRole)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}. Must be one of: ${EDITABLE_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate all permission keys
    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
      return NextResponse.json({ error: 'permissions must be an object' }, { status: 400 });
    }
    for (const key of Object.keys(permissions)) {
      if (!PERMISSION_KEY_SET.has(key)) {
        return NextResponse.json(
          { error: `Unknown permission key: '${key}'. Allowed keys: ${PERMISSION_KEYS.join(', ')}` },
          { status: 400 }
        );
      }
      if (typeof permissions[key] !== 'boolean') {
        return NextResponse.json(
          { error: `Permission value for '${key}' must be a boolean` },
          { status: 400 }
        );
      }
    }

    // Read actor's role from their users document
    const actorDoc = await adminDb.collection('users').doc(uid).get();
    if (!actorDoc.exists) return NextResponse.json({ error: 'Actor not found' }, { status: 403 });
    const actorRole: WorkspaceRole = actorDoc.data()?.workspaceRole ?? 'member';
    const workspaceId = actorDoc.data()?.workspaceId;
    if (!workspaceId) return NextResponse.json({ error: 'No workspace associated' }, { status: 403 });

    // Enforce role hierarchy
    const editableByActor = CAN_EDIT[actorRole] ?? [];
    if (!editableByActor.includes(role as WorkspaceRole)) {
      return NextResponse.json(
        { error: `Your role ('${actorRole}') does not have permission to edit the '${role}' role.` },
        { status: 403 }
      );
    }

    // Read current matrix and apply updates
    const wpRef = adminDb.collection('workspacePermissions').doc(workspaceId);
    const wpDoc = await wpRef.get();
    const currentMatrix = wpDoc.exists
      ? (wpDoc.data()?.permissions ?? SYSTEM_DEFAULTS)
      : SYSTEM_DEFAULTS;

    const currentRolePerms: PermissionMap = currentMatrix[role as WorkspaceRole] ?? SYSTEM_DEFAULTS[role as WorkspaceRole];
    const updatedRolePerms: PermissionMap = { ...currentRolePerms, ...(permissions as Partial<PermissionMap>) };

    await wpRef.set(
      {
        workspaceId,
        permissions: { ...currentMatrix, [role]: updatedRolePerms },
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: uid,
      },
      { merge: true }
    );

    // Batch-update effectivePermissions on all users with the affected role
    // so the cache stays consistent — fire-and-forget (non-blocking)
    adminDb
      .collection('users')
      .where('workspaceId', '==', workspaceId)
      .where('workspaceRole', '==', role)
      .get()
      .then(async (snapshot) => {
        if (snapshot.empty) return;
        const batch = adminDb.batch();
        for (const doc of snapshot.docs) {
          batch.update(doc.ref, { effectivePermissions: updatedRolePerms });
        }
        await batch.commit();
      })
      .catch(err => console.error('batch effectivePermissions update failed:', err));

    // Audit log — fire-and-forget
    adminDb.collection('auditLogs').add({
      userId: uid,
      action: 'rbac_permissions_updated',
      resourceType: 'rbac',
      metadata: { role, permissions, workspaceId },
      status: 'success',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('audit log write failed:', err));

    return NextResponse.json({ success: true, role, updatedPermissions: updatedRolePerms });
  } catch (error) {
    console.error('PATCH /api/rbac/permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
