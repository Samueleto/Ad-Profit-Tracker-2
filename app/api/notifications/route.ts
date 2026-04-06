import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    // cursor is a numeric offset into the ordered result set
    const offset = Math.max(0, parseInt(searchParams.get('cursor') || '0', 10) || 0);

    // Read from the notifications collection — consistent with create/read/bulk-read
    let query = adminDb
      .collection('notifications')
      .where('uid', '==', uid)
      .where('isDismissed', '==', false)
      .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

    if (unreadOnly) {
      query = query.where('isRead', '==', false);
    }

    // Fetch one extra to determine hasMore
    query = query.limit(offset + limit + 1);
    const snapshot = await query.get();

    const all = snapshot.docs;
    const unreadCount = unreadOnly
      ? all.length // already filtered
      : undefined; // compute separately below if needed

    const pageDocs = all.slice(offset, offset + limit);
    const hasMore = all.length > offset + limit;

    const notifications = pageDocs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        type: d.type ?? 'info',
        title: d.title ?? '',
        message: d.message ?? '',
        isRead: d.isRead ?? d.read ?? false,
        isDismissed: d.isDismissed ?? false,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    // Unread count: efficient separate query only if not already filtered
    let computedUnreadCount: number;
    if (unreadOnly) {
      computedUnreadCount = all.length;
    } else {
      const unreadSnap = await adminDb
        .collection('notifications')
        .where('uid', '==', uid)
        .where('isRead', '==', false)
        .where('isDismissed', '==', false)
        .count()
        .get();
      computedUnreadCount = unreadSnap.data().count;
    }

    return NextResponse.json({
      notifications,
      unreadCount: computedUnreadCount,
      hasMore,
      nextCursor: hasMore ? String(offset + limit) : null,
    });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    // Batch-delete all notifications for this user from the notifications collection
    const snapshot = await adminDb
      .collection('notifications')
      .where('uid', '==', uid)
      .limit(500)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ success: true, cleared: 0 });
    }

    const batch = adminDb.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    return NextResponse.json({ success: true, cleared: snapshot.docs.length });
  } catch (error) {
    console.error('DELETE /api/notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
