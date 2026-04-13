import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { subDays } from 'date-fns';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  try {
    const { id } = await params;
    const doc = await adminDb.collection('helpArticles').doc(id).get();

    if (!doc.exists || !doc.data()?.isPublished) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const d = doc.data()!;
    const updatedAt = d.updatedAt?.toDate?.() ?? new Date(0);
    const sevenDaysAgo = subDays(new Date(), 7);

    const article = {
      id: doc.id,
      title: d.title,
      slug: d.slug,
      category: d.category,
      body: d.body ?? '',
      summary: d.summary ?? '',
      tags: d.tags ?? [],
      requiredPermission: d.requiredPermission ?? null,
      requiredRole: d.requiredRole ?? null,
      readTimeMinutes: d.readTimeMinutes ?? 5,
      videoUrl: d.videoUrl ?? null,
      viewCount: d.viewCount ?? 0,
      helpfulCount: d.helpfulCount ?? 0,
      notHelpfulCount: d.notHelpfulCount ?? 0,
      isPublished: d.isPublished,
      authorName: d.authorName ?? 'Admin',
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
      updatedAt: updatedAt.toISOString(),
      isNew: updatedAt > sevenDaysAgo,
    };

    return NextResponse.json({ article });
  } catch (error) {
    console.error('GET /api/help/articles/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/help/articles/[id]/view calls a sub-path route; this handler
// catches a plain PATCH on the article itself (unused by current hooks).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  try {
    const { id } = await params;
    const doc = await adminDb.collection('helpArticles').doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Increment view count (fire-and-forget from hook, so best-effort is fine)
    await doc.ref.update({ viewCount: FieldValue.increment(1) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/help/articles/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
