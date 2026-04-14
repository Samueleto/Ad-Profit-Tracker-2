import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { computeRoi, getColorCode, getRoiIndicator } from '@/lib/roi/formula';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const groupBy = searchParams.get('groupBy') || 'total';

    let statsQuery = adminDb
      .collection('adStats')
      .where('uid', '==', uid) as FirebaseFirestore.Query;

    if (dateFrom) statsQuery = statsQuery.where('date', '>=', dateFrom);
    if (dateTo) statsQuery = statsQuery.where('date', '<=', dateTo);

    const snapshot = await statsQuery.get();

    let totalRevenue = 0, totalCost = 0;

    snapshot.forEach(doc => {
      const d = doc.data();
      totalRevenue += d.revenue || 0;
      totalCost += d.cost || 0;
    });

    const roi = computeRoi(totalRevenue, totalCost);
    const colorCode = getColorCode(roi);
    const roiIndicator = getRoiIndicator(roi);
    const netProfit = totalRevenue - totalCost;

    return NextResponse.json({
      dateFrom,
      dateTo,
      roi,
      roiIndicator,
      colorCode,
      totalRevenue,
      totalCost,
      netProfit,
      roiChange: null,
      roiChangeDirection: null,
      groupBy,
      cachedAt: null,
    });
  } catch (error) {
    console.error('roi/metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
