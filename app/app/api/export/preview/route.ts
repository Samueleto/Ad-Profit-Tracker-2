import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { EXPORT_SHEET_KEYS } from '@/features/excel-export/types';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    let statsQuery = adminDb.collection('adStats').where('userId', '==', uid) as FirebaseFirestore.Query;
    if (dateFrom) statsQuery = statsQuery.where('date', '>=', dateFrom);
    if (dateTo) statsQuery = statsQuery.where('date', '<=', dateTo);

    const snapshot = await statsQuery.get();
    const totalRows = snapshot.size;

    // Count by category
    const networkCounts: Record<string, number> = {};
    const dateCounts = new Set<string>();
    const countryCounts = new Set<string>();

    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.networkId) networkCounts[d.networkId] = (networkCounts[d.networkId] || 0) + 1;
      if (d.date) dateCounts.add(d.date);
      if (d.country) countryCounts.add(d.country);
    });

    const sheets = {
      summary: 1,
      daily_trend: dateCounts.size,
      geo_breakdown: countryCounts.size,
      exoclick: networkCounts['exoclick'] || 0,
      rollerads: networkCounts['rollerads'] || 0,
      zeydoo: networkCounts['zeydoo'] || 0,
      propush: networkCounts['propush'] || 0,
      activity_log: 0,
    } as Record<typeof EXPORT_SHEET_KEYS[number], number>;

    return NextResponse.json({
      dateFrom,
      dateTo,
      sheets,
      totalRows,
      hasData: totalRows > 0,
      cachedAt: null,
    });
  } catch (error) {
    console.error('export/preview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
