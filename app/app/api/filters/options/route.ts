import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { SUPPORTED_NETWORKS } from '@/lib/constants';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    let statsQuery = adminDb
      .collection('adStats')
      .where('userId', '==', uid) as FirebaseFirestore.Query;
    if (dateFrom) statsQuery = statsQuery.where('date', '>=', dateFrom);
    if (dateTo) statsQuery = statsQuery.where('date', '<=', dateTo);

    const snapshot = await statsQuery.get();

    const countriesSet = new Set<string>();
    const networksWithData = new Set<string>();

    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.country) countriesSet.add(d.country);
      if (d.networkId) networksWithData.add(d.networkId);
    });

    const countries = Array.from(countriesSet).sort().map(c => ({
      country: c,
      countryName: c,
      hasData: true,
    }));

    const networks = SUPPORTED_NETWORKS.map(networkId => ({
      networkId,
      label: networkId.charAt(0).toUpperCase() + networkId.slice(1),
      dataRole: networkId === 'exoclick' ? 'cost' as const : 'revenue' as const,
      hasData: networksWithData.has(networkId),
    }));

    const metrics = [
      { metric: 'revenue', label: 'Revenue', unit: 'USD' },
      { metric: 'cost', label: 'Cost', unit: 'USD' },
      { metric: 'profit', label: 'Net Profit', unit: 'USD' },
      { metric: 'roi', label: 'ROI', unit: '%' },
      { metric: 'impressions', label: 'Impressions', unit: 'count' },
      { metric: 'clicks', label: 'Clicks', unit: 'count' },
      { metric: 'ctr', label: 'CTR', unit: '%' },
      { metric: 'cpm', label: 'CPM', unit: 'USD' },
    ];

    return NextResponse.json({ dateFrom, dateTo, countries, networks, metrics, cachedAt: null });
  } catch (error) {
    console.error('filters/options error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
