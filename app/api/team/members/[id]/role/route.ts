import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

const VALID_ROLES = new Set(['owner', 'admin', 'member']);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const requesterUid = authResult.token.uid;

  const { id: targetUid } = await params;

  if (!targetUid) {
    return NextResponse.json({ error: 'Member id is required' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { role } = body;
  if (!role || typeof role !== 'string' || !VALID_ROLES.has(role)) {
    return NextResponse.json(
      { error: 'role must be owner, admin, or member' },
      { status: 400 }
    );
  }

  if (requesterUid === targetUid) {
    return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
  }

  try {
    // Fetch both requester and target in parallel
    const [requesterDoc, targetDoc] = await Promise.all([
      adminDb.collection('users').doc(requesterUid).get(),
      adminDb.collection('users').doc(targetUid).get(),
    ]);

    if (!requesterDoc.exists || !targetDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const requesterData = requesterDoc.data()!;
    const targetData = targetDoc.data()!;

    // Both must be in the same workspace
    if (!requesterData.workspaceId || requesterData.workspaceId !== targetData.workspaceId) {
      return NextResponse.json({ error: 'Target user is not in your workspace' }, { status: 403 });
    }

    const wsId = requesterData.workspaceId as string;
    const wsDoc = await adminDb.collection('workspaces').doc(wsId).get();
    const wsData = wsDoc.exists ? wsDoc.data()! : null;

    const requesterIsOwner = wsData?.ownerUid === requesterUid;
    const requesterRole: string = requesterData.workspaceRole ?? 'member';

    if (!requesterIsOwner && requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Only workspace owners and admins can change member roles' }, { status: 403 });
    }

    // Only the owner can assign the owner role (ownership transfer)
    if (role === 'owner' && !requesterIsOwner) {
      return NextResponse.json({ error: 'Only the workspace owner can transfer ownership' }, { status: 403 });
    }

    // Cannot demote the workspace owner unless you are the owner (transferring ownership)
    const targetIsOwner = wsData?.ownerUid === targetUid;
    if (targetIsOwner && role !== 'owner' && !requesterIsOwner) {
      return NextResponse.json({ error: 'Cannot demote the workspace owner' }, { status: 403 });
    }

    if (role === 'owner') {
      // Ownership transfer: new owner becomes owner, requester drops to admin
      await adminDb.runTransaction(async (tx) => {
        tx.update(targetDoc.ref, {
          workspaceRole: 'owner',
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(requesterDoc.ref, {
          workspaceRole: 'admin',
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (wsDoc.exists) {
          tx.update(wsDoc.ref, {
            ownerUid: targetUid,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
    } else {
      await targetDoc.ref.update({
        workspaceRole: role,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true, role });
  } catch (error) {
    console.error('PATCH /api/team/members/[id]/role error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
