import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

const MAX_WORKSPACE_NAME_LENGTH = 80;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const workspaceId: string | undefined = userData.workspaceId;

    if (!workspaceId) {
      // Solo user — synthesize a workspace from user data
      return NextResponse.json({
        workspace: {
          workspaceId: uid,
          workspaceName: userData.workspaceName ?? userData.displayName ?? 'My Workspace',
          ownerUid: uid,
          memberCount: 1,
          createdAt: userData.createdAt ?? null,
          currentUserRole: 'owner',
        },
      });
    }

    const wsDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const ws = wsDoc.data()!;

    // Count members
    const membersSnap = await adminDb
      .collection('users')
      .where('workspaceId', '==', workspaceId)
      .count()
      .get();

    const currentUserRole: string =
      ws.ownerUid === uid
        ? 'owner'
        : (userData.workspaceRole ?? 'member');

    return NextResponse.json({
      workspace: {
        workspaceId,
        workspaceName: ws.workspaceName ?? '',
        ownerUid: ws.ownerUid ?? '',
        memberCount: membersSnap.data().count,
        createdAt: ws.createdAt ?? null,
        currentUserRole,
      },
    });
  } catch (error) {
    console.error('GET /api/team/workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspaceName } = body;
  if (!workspaceName || typeof workspaceName !== 'string' || !workspaceName.trim()) {
    return NextResponse.json({ error: 'workspaceName is required' }, { status: 400 });
  }
  if (workspaceName.trim().length > MAX_WORKSPACE_NAME_LENGTH) {
    return NextResponse.json(
      { error: `workspaceName must be ${MAX_WORKSPACE_NAME_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const workspaceId: string | undefined = userData.workspaceId;

    if (!workspaceId) {
      // Solo user — store on user doc
      await adminDb.collection('users').doc(uid).update({
        workspaceName: workspaceName.trim(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Only owner or admin may rename workspace
      const currentUserRole = userData.workspaceRole ?? 'member';
      const wsDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
      const isOwner = wsDoc.exists && wsDoc.data()?.ownerUid === uid;
      if (!isOwner && currentUserRole !== 'admin') {
        return NextResponse.json({ error: 'Only the workspace owner or admin can rename the workspace' }, { status: 403 });
      }

      await adminDb.collection('workspaces').doc(workspaceId).update({
        workspaceName: workspaceName.trim(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true, workspaceName: workspaceName.trim() });
  } catch (error) {
    console.error('PATCH /api/team/workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
