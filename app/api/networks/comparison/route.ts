import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { computeRoi } from '@/lib/roi/formula';
import { SUPPORTED_NETWORKS } from '@/lib/constants';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const metric = searchParams.get('metric') || 'revenue';

    // Query adStats for all networks
    let statsQuery = adminDb
      .collection('adStats')
      .where('uid', '==', uid) as FirebaseFirestore.Query;
    if (dateFrom) statsQuery = statsQuery.where('date', '>=', dateFrom);
    if (dateTo) statsQuery = statsQuery.where('date', '<=', dateTo);

    const snapshot = await statsQuery.get();

    // Aggregate by network
    const networkStats: Record<string, {
      revenue: number; cost: number; impressions: number; clicks: number; daysWithData: Set<string>
    }> = {};

    SUPPORTED_NETWORKS.forEach(n => {
      networkStats[n] = { revenue: 0, cost: 0, impressions: 0, clicks: 0, daysWithData: new Set() };
    });

    snapshot.forEach(doc => {
      const d = doc.data();
      const net = d.networkId;
      if (networkStats[net]) {
        networkStats[net].revenue += d.revenue || 0;
        networkStats[net].cost += d.cost || 0;
        networkStats[net].impressions += d.impressions || 0;
        networkStats[net].clicks += d.clicks || 0;
        networkStats[net].daysWithData.add(d.date);
      }
    });

    // Get network configs for status
    const configsSnapshot = await adminDb
      .collection('users')
      .doc(uid)
      .collection('networkConfigs')
      .get();

    const configMap: Record<string, { lastSyncedAt: string | null; lastSyncStatus: string; circuitBreakerOpen: boolean }> = {};
    configsSnapshot.forEach(doc => {
      const d = doc.data();
      configMap[d.networkId] = {
        lastSyncedAt: d.lastSyncedAt?.toDate?.()?.toISOString() ?? null,
        lastSyncStatus: d.lastSyncStatus ?? 'never',
        circuitBreakerOpen: d.circuitBreakerOpen ?? false,
      };
    });

    const totalRevenue = Object.values(networkStats).reduce((s, n) => s + n.revenue, 0);
    const totalCost = Object.values(networkStats).reduce((s, n) => s + n.cost, 0);
    const netProfit = totalRevenue - totalCost;
    const overallRoi = computeRoi(totalRevenue, totalCost);

    // Build networks array with ranks
    const networksData = SUPPORTED_NETWORKS.map(networkId => {
      const stats = networkStats[networkId];
      const dataRole: 'cost' | 'revenue' = networkId === 'exoclick' ? 'cost' : 'revenue';
      const primaryMetric = dataRole === 'cost' ? stats.cost : stats.revenue;
      const totalForShare = dataRole === 'cost' ? totalCost : totalRevenue;
      const metricShare = totalForShare > 0 ? (primaryMetric / totalForShare) * 100 : 0;
      const averageCtr = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0;
      const averageCpm = stats.impressions > 0 ? (primaryMetric / stats.impressions) * 1000 : 0;

      return {
        networkId,
        dataRole,
        primaryMetric,
        impressions: stats.impressions,
        clicks: stats.clicks,
        averageCtr,
        averageCpm,
        daysWithData: stats.daysWithData.size,
        metricShare,
        rank: 0, // Will be set after sorting
        networkStatus: configMap[networkId] ?? { lastSyncedAt: null, lastSyncStatus: 'never', circuitBreakerOpen: false },
      };
    });

    // Rank by primary metric
    networksData.sort((a, b) => b.primaryMetric - a.primaryMetric);
    networksData.forEach((n, idx) => { n.rank = idx + 1; });

    const rankings = networksData.map(n => ({
      networkId: n.networkId,
      rank: n.rank,
      metricValue: n.primaryMetric,
      metricLabel: n.dataRole === 'cost' ? 'Cost' : 'Revenue',
    }));

    return NextResponse.json({
      dateFrom,
      dateTo,
      metric,
      networks: networksData,
      crossNetwork: {
        totalRevenue,
        totalCost,
        netProfit,
        overallRoi,
        revenuePerImpression: null,
        costPerClick: null,
      },
      rankings,
      cachedAt: null,
    });
  } catch (error) {
    console.error('networks/comparison error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
