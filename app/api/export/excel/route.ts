import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { checkExportRateLimit } from '@/lib/export-rate-limit';
import { ExcelExportRequestSchema } from '@/features/excel-export/types';
import ExcelJS from 'exceljs';

const FILENAME_RE = /^[a-zA-Z0-9_-]{1,100}$/;

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  // Shared rate limit — counts against the same 10/hour budget as PDF exports
  const rl = checkExportRateLimit(uid);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Export rate limit exceeded. Maximum 10 exports per hour.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } }
    );
  }

  try {
    const body = await request.json();
    const parsed = ExcelExportRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { dateFrom, dateTo, sheets, filename, includeHeaders } = parsed.data;

    // Filename sanitization — prevent header injection in Content-Disposition
    if (filename && !FILENAME_RE.test(filename)) {
      return NextResponse.json(
        { error: 'Invalid filename. Only alphanumeric characters, dashes, and underscores are allowed (1–100 chars).' },
        { status: 400 }
      );
    }

    // Query data — uid always comes from verified token, never from request
    let statsQuery = adminDb.collection('adStats').where('uid', '==', uid) as FirebaseFirestore.Query;
    statsQuery = statsQuery.where('date', '>=', dateFrom).where('date', '<=', dateTo);
    const snapshot = await statsQuery.get();

    const stats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Build workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ad Profit Tracker';
    workbook.created = new Date();

    if (sheets.includes('summary')) {
      const ws = workbook.addWorksheet('Summary');
      if (includeHeaders) ws.addRow(['Date From', 'Date To', 'Total Records']);
      ws.addRow([dateFrom, dateTo, stats.length]);
    }

    if (sheets.includes('daily_trend')) {
      const ws = workbook.addWorksheet('Daily Trend');
      if (includeHeaders) ws.addRow(['Date', 'Revenue', 'Cost', 'Net Profit', 'Impressions', 'Clicks']);
      const byDate: Record<string, { revenue: number; cost: number; impressions: number; clicks: number }> = {};
      stats.forEach((s: Record<string, unknown>) => {
        const date = s.date as string;
        if (!byDate[date]) byDate[date] = { revenue: 0, cost: 0, impressions: 0, clicks: 0 };
        byDate[date].revenue += (s.revenue as number) || 0;
        byDate[date].cost += (s.cost as number) || 0;
        byDate[date].impressions += (s.impressions as number) || 0;
        byDate[date].clicks += (s.clicks as number) || 0;
      });
      Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, d]) => {
        ws.addRow([date, d.revenue, d.cost, d.revenue - d.cost, d.impressions, d.clicks]);
      });
    }

    // Add per-network sheets
    const networkSheets = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
    for (const network of networkSheets) {
      if (sheets.includes(network)) {
        const ws = workbook.addWorksheet(network.charAt(0).toUpperCase() + network.slice(1));
        if (includeHeaders) ws.addRow(['Date', 'Country', 'Revenue', 'Cost', 'Impressions', 'Clicks']);
        stats
          .filter((s: Record<string, unknown>) => s.networkId === network)
          .sort((a: Record<string, unknown>, b: Record<string, unknown>) => String(a.date).localeCompare(String(b.date)))
          .forEach((s: Record<string, unknown>) => {
            ws.addRow([s.date, s.country, s.revenue, s.cost, s.impressions, s.clicks]);
          });
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    // Use only the sanitized filename (already validated above) to prevent header injection
    const safeBase = filename && FILENAME_RE.test(filename) ? filename : 'export';
    const outputFilename = `${safeBase}_${dateFrom}_${dateTo}.xlsx`;

    // Write audit log — fire-and-forget (don't block the response)
    adminDb.collection('auditLogs').add({
      userId: uid,
      action: 'manual_sync_triggered',
      resourceType: 'sync',
      resourceId: 'export',
      metadata: {
        sheetsIncluded: sheets,
        dateFrom,
        dateTo,
        rowCount: stats.length,
        filename: outputFilename,
      },
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('audit log write failed:', err));

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${outputFilename}"`,
      },
    });
  } catch (error) {
    console.error('export/excel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
