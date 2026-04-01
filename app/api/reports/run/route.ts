import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { validateReportConfig } from '@/lib/reportValidation';
import { computeRoi } from '@/lib/roi/formula';
import { format, subDays, startOfMonth } from 'date-fns';

function resolveDates(preset: string, dateFrom: string | null, dateTo: string | null) {
  const today = new Date();
  if (preset === 'custom' && dateFrom && dateTo) return { dateFrom, dateTo };
  switch (preset) {
    case 'last_7': return { dateFrom: format(subDays(today, 6), 'yyyy-MM-dd'), dateTo: format(today, 'yyyy-MM-dd') };
    case 'last_14': return { dateFrom: format(subDays(today, 13), 'yyyy-MM-dd'), dateTo: format(today, 'yyyy-MM-dd') };
    case 'last_30': return { dateFrom: format(subDays(today, 29), 'yyyy-MM-dd'), dateTo: format(today, 'yyyy-MM-dd') };
    case 'last_90': return { dateFrom: format(subDays(today, 89), 'yyyy-MM-dd'), dateTo: format(today, 'yyyy-MM-dd') };
    case 'this_month': return { dateFrom: format(startOfMonth(today), 'yyyy-MM-dd'), dateTo: format(today, 'yyyy-MM-dd') };
    default: return { dateFrom: format(subDays(today, 29), 'yyyy-MM-dd'), dateTo: format(today, 'yyyy-MM-dd') };
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const validation = validateReportConfig(body);

    if (!validation.valid) {
      return NextResponse.json({ error: 'Invalid config', errors: validation.errors }, { status: 400 });
    }

    const { dateFrom: resolvedFrom, dateTo: resolvedTo } = resolveDates(
      body.dateRangePreset,
      body.dateFrom,
      body.dateTo
    );

    let statsQuery = adminDb.collection('adStats').where('userId', '==', uid) as FirebaseFirestore.Query;
    statsQuery = statsQuery.where('date', '>=', resolvedFrom).where('date', '<=', resolvedTo);

    if (body.networks?.length > 0) {
      statsQuery = statsQuery.where('networkId', 'in', body.networks.slice(0, 10));
    }

    const snapshot = await statsQuery.get();

    // Group by selected groupBy
    const groups: Record<string, { revenue: number; cost: number; impressions: number; clicks: number }> = {};

    snapshot.forEach(doc => {
      const d = doc.data();
      if (body.countries?.length > 0 && !body.countries.includes(d.country)) return;

      let key: string;
      if (body.groupBy === 'country') key = d.country || 'unknown';
      else if (body.groupBy === 'network') key = d.networkId;
      else key = d.date; // daily

      if (!groups[key]) groups[key] = { revenue: 0, cost: 0, impressions: 0, clicks: 0 };
      groups[key].revenue += d.revenue || 0;
      groups[key].cost += d.cost || 0;
      groups[key].impressions += d.impressions || 0;
      groups[key].clicks += d.clicks || 0;
    });

    const metrics: string[] = body.metrics || ['revenue', 'cost', 'netProfit', 'roi'];
    const rows = Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, stats]) => {
        const row: Record<string, unknown> = { key, label: key };
        if (metrics.includes('revenue')) row.revenue = stats.revenue;
        if (metrics.includes('cost')) row.cost = stats.cost;
        if (metrics.includes('netProfit')) row.netProfit = stats.revenue - stats.cost;
        if (metrics.includes('roi')) row.roi = computeRoi(stats.revenue, stats.cost);
        if (metrics.includes('impressions')) row.impressions = stats.impressions;
        if (metrics.includes('clicks')) row.clicks = stats.clicks;
        if (metrics.includes('ctr')) row.ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : null;
        if (metrics.includes('cpm')) row.cpm = stats.impressions > 0 ? (stats.revenue / stats.impressions) * 1000 : null;
        return row;
      });

    const totalRevenue = rows.reduce((s, r) => s + ((r.revenue as number) || 0), 0);
    const totalCost = rows.reduce((s, r) => s + ((r.cost as number) || 0), 0);

    return NextResponse.json({
      dateFrom: resolvedFrom,
      dateTo: resolvedTo,
      config: body,
      rows,
      summary: {
        revenue: totalRevenue,
        cost: totalCost,
        netProfit: totalRevenue - totalCost,
        roi: computeRoi(totalRevenue, totalCost),
        totalRows: rows.length,
      },
      hasMore: false,
      nextCursor: null,
      cachedAt: null,
    });
  } catch (error) {
    console.error('reports/run error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
