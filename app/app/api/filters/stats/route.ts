import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { computeRoi } from '@/lib/roi/formula';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const networks = searchParams.get('networks')?.split(',').filter(Boolean) || [];
    const countries = searchParams.get('countries')?.split(',').filter(Boolean) || [];
    const groupBy = searchParams.get('groupBy') || 'network';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    let statsQuery = adminDb
      .collection('adStats')
      .where('userId', '==', uid) as FirebaseFirestore.Query;
    if (dateFrom) statsQuery = statsQuery.where('date', '>=', dateFrom);
    if (dateTo) statsQuery = statsQuery.where('date', '<=', dateTo);

    const snapshot = await statsQuery.get();
    const aggregated: Record<string, { revenue: number; cost: number; impressions: number; clicks: number; rowCount: number }> = {};

    snapshot.forEach(doc => {
      const d = doc.data();
      if (networks.length > 0 && !networks.includes(d.networkId)) return;
      if (countries.length > 0 && !countries.includes(d.country)) return;

      const key = groupBy === 'country' ? (d.country || 'unknown') : d.networkId;
      if (!aggregated[key]) aggregated[key] = { revenue: 0, cost: 0, impressions: 0, clicks: 0, rowCount: 0 };
      aggregated[key].revenue += d.revenue || 0;
      aggregated[key].cost += d.cost || 0;
      aggregated[key].impressions += d.impressions || 0;
      aggregated[key].clicks += d.clicks || 0;
      aggregated[key].rowCount++;
    });

    const rows = Object.entries(aggregated)
      .map(([key, stats]) => ({
        key,
        label: key,
        revenue: stats.revenue,
        cost: stats.cost,
        netProfit: stats.revenue - stats.cost,
        roi: computeRoi(stats.revenue, stats.cost),
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
        cpm: stats.impressions > 0 ? (stats.revenue / stats.impressions) * 1000 : 0,
        rowCount: stats.rowCount,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalCost = rows.reduce((s, r) => s + r.cost, 0);

    return NextResponse.json({
      rows,
      summary: {
        totalRevenue,
        totalCost,
        netProfit: totalRevenue - totalCost,
        roi: computeRoi(totalRevenue, totalCost),
      },
      filters: { networks, countries },
      hasMore: false,
      nextCursor: null,
      cachedAt: null,
    });
  } catch (error) {
    console.error('filters/stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
