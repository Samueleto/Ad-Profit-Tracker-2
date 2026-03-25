import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { subDays } from 'date-fns';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    let query = adminDb
      .collection('helpArticles')
      .where('isPublished', '==', true) as FirebaseFirestore.Query;

    if (category) {
      query = query.where('category', '==', category);
    }

    query = query.orderBy('updatedAt', 'desc').limit(limit);

    const snapshot = await query.get();
    const sevenDaysAgo = subDays(new Date(), 7);

    const articles = snapshot.docs.map(doc => {
      const d = doc.data();
      const updatedAt = d.updatedAt?.toDate?.() ?? new Date(0);
      return {
        id: doc.id,
        title: d.title,
        slug: d.slug,
        category: d.category,
        summary: d.summary,
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
    });

    // Group by category
    const categoryGroups: Record<string, number> = {};
    articles.forEach(a => {
      categoryGroups[a.category] = (categoryGroups[a.category] || 0) + 1;
    });

    const categories = Object.entries(categoryGroups).map(([cat, count]) => ({ category: cat, count }));

    return NextResponse.json({ articles, categoryGroups: categories, total: articles.length });
  } catch (error) {
    console.error('help/articles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
