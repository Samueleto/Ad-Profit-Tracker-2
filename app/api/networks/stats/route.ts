import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { isValidNetworkId } from '@/lib/constants';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get('networkId');
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const groupBy = searchParams.get('groupBy') || 'daily';

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: 'Invalid or missing networkId' }, { status: 400 });
    }

    let statsQuery = adminDb
      .collection('adStats')
      .where('uid', '==', uid)
      .where('networkId', '==', networkId) as FirebaseFirestore.Query;

    if (dateFrom) statsQuery = statsQuery.where('date', '>=', dateFrom);
    if (dateTo) statsQuery = statsQuery.where('date', '<=', dateTo);

    const snapshot = await statsQuery.get();

    let totalPrimaryMetric = 0, totalImpressions = 0, totalClicks = 0;
    const dateSet = new Set<string>();
    const countrySet = new Set<string>();
    const dailySeries: Record<string, { primaryMetric: number; impressions: number; clicks: number }> = {};
    const countryStats: Record<string, { primaryMetric: number; impressions: number; clicks: number }> = {};

    const dataRole: 'cost' | 'revenue' = networkId === 'exoclick' ? 'cost' : 'revenue';

    snapshot.forEach(doc => {
      const d = doc.data();
      const primaryMetric = dataRole === 'cost' ? (d.cost || 0) : (d.revenue || 0);

      totalPrimaryMetric += primaryMetric;
      totalImpressions += d.impressions || 0;
      totalClicks += d.clicks || 0;
      dateSet.add(d.date);
      if (d.country) countrySet.add(d.country);

      if (!dailySeries[d.date]) {
        dailySeries[d.date] = { primaryMetric: 0, impressions: 0, clicks: 0 };
      }
      dailySeries[d.date].primaryMetric += primaryMetric;
      dailySeries[d.date].impressions += d.impressions || 0;
      dailySeries[d.date].clicks += d.clicks || 0;

      if (d.country) {
        if (!countryStats[d.country]) {
          countryStats[d.country] = { primaryMetric: 0, impressions: 0, clicks: 0 };
        }
        countryStats[d.country].primaryMetric += primaryMetric;
        countryStats[d.country].impressions += d.impressions || 0;
        countryStats[d.country].clicks += d.clicks || 0;
      }
    });

    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const averageCpm = totalImpressions > 0 ? (totalPrimaryMetric / totalImpressions) * 1000 : 0;

    const series = Object.entries(dailySeries)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        primaryMetric: stats.primaryMetric,
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
        cpm: stats.impressions > 0 ? (stats.primaryMetric / stats.impressions) * 1000 : 0,
      }));

    const countries = Object.entries(countryStats)
      .sort(([, a], [, b]) => b.primaryMetric - a.primaryMetric)
      .map(([country, stats]) => ({
        country,
        countryName: country,
        primaryMetric: stats.primaryMetric,
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
        cpm: stats.impressions > 0 ? (stats.primaryMetric / stats.impressions) * 1000 : 0,
        metricShare: totalPrimaryMetric > 0 ? (stats.primaryMetric / totalPrimaryMetric) * 100 : 0,
      }));

    // Get network status
    const configDoc = await adminDb
      .collection('networkConfigs')
      .where('userId', '==', uid)
      .where('networkId', '==', networkId)
      .limit(1)
      .get();

    const configData = configDoc.empty ? null : configDoc.docs[0].data();

    return NextResponse.json({
      networkId,
      dataRole,
      dateFrom,
      dateTo,
      groupBy,
      summary: {
        primaryMetric: totalPrimaryMetric,
        impressions: totalImpressions,
        clicks: totalClicks,
        averageCtr,
        averageCpm,
        countryCount: countrySet.size,
        daysWithData: dateSet.size,
      },
      series,
      countries,
      networkStatus: {
        lastSyncedAt: configData?.lastSyncedAt?.toDate?.()?.toISOString() ?? null,
        lastSyncStatus: configData?.lastSyncStatus ?? 'never',
        circuitBreakerOpen: configData?.circuitBreakerOpen ?? false,
      },
      cachedAt: null,
    });
  } catch (error) {
    console.error('networks/stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
