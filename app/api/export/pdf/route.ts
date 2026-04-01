import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { checkExportRateLimit } from "@/lib/export-rate-limit";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FILENAME_RE = /^[a-zA-Z0-9_-]{1,100}$/;

// In-memory cache: uid-prefixed so a cache hit for one user is never served to another.
const previewCache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: Request) {
  // 1. Auth — must be first, before any Firestore access or cache lookup
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // 2. Shared rate limit (counts against the same budget as Excel exports)
  const rl = checkExportRateLimit(uid);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Export rate limit exceeded. Maximum 10 exports per hour." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter ?? 3600) },
      }
    );
  }

  try {
    const body = await request.json();
    const { dateFrom, dateTo, title, includeCharts = false, filename } = body;

    // 3. Date validation
    const today = new Date();
    const defaultEnd = today.toISOString().split("T")[0];
    const defaultStart = new Date(today.getTime() - 30 * 86400000)
      .toISOString()
      .split("T")[0];
    const from = dateFrom || defaultStart;
    const to = dateTo || defaultEnd;

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json(
        { error: "dateFrom and dateTo must be YYYY-MM-DD" },
        { status: 400 }
      );
    }
    if (from > to) {
      return NextResponse.json(
        { error: "dateFrom must be ≤ dateTo" },
        { status: 400 }
      );
    }

    // 4. Filename sanitization — reject before touching Firestore or headers
    if (filename !== undefined && filename !== null && filename !== "") {
      if (!FILENAME_RE.test(filename)) {
        return NextResponse.json(
          {
            error:
              "Invalid filename. Only alphanumeric characters, dashes, and underscores are allowed (1–100 chars).",
          },
          { status: 400 }
        );
      }
    }

    // 5. Uid-prefixed cache key — a cache hit for User A is never served to User B
    const cacheKey = `${uid}_export_preview_${from}_${to}`;
    const cached = previewCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json({ report: cached.data });
    }

    // 6. Firestore — uid always from verified token, never from request body
    const snapshot = await adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .where("date", ">=", from)
      .where("date", "<=", to)
      .orderBy("date", "asc")
      .get();

    const networkTotals: Record<
      string,
      {
        revenue: number;
        cost: number;
        profit: number;
        impressions: number;
        clicks: number;
      }
    > = {};
    let totalRevenue = 0,
      totalCost = 0,
      totalImpressions = 0,
      totalClicks = 0;

    for (const doc of snapshot.docs) {
      const d = doc.data();
      const net = d.networkId as string;
      if (!networkTotals[net])
        networkTotals[net] = {
          revenue: 0,
          cost: 0,
          profit: 0,
          impressions: 0,
          clicks: 0,
        };
      const revenue = Number(d.revenue) || 0;
      const cost = Number(d.cost) || 0;
      networkTotals[net].revenue += revenue;
      networkTotals[net].cost += cost;
      networkTotals[net].profit += revenue - cost;
      networkTotals[net].impressions += Number(d.impressions) || 0;
      networkTotals[net].clicks += Number(d.clicks) || 0;
      totalRevenue += revenue;
      totalCost += cost;
      totalImpressions += Number(d.impressions) || 0;
      totalClicks += Number(d.clicks) || 0;
    }

    const reportTitle = title || `Ad Performance Report: ${from} to ${to}`;
    const generatedAt = new Date().toISOString();

    const report = {
      title: reportTitle,
      dateFrom: from,
      dateTo: to,
      generatedAt,
      summary: {
        totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        totalImpressions,
        totalClicks,
        roi: totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0,
      },
      networkBreakdown: networkTotals,
      recordCount: snapshot.size,
      includeCharts,
    };

    // Store in uid-prefixed cache
    previewCache.set(cacheKey, { data: report, expiresAt: Date.now() + CACHE_TTL_MS });

    // 7. Audit log — fire-and-forget, scoped to the exporting user's uid
    adminDb
      .collection("auditLogs")
      .add({
        userId: uid,
        action: "pdf_export",
        resourceType: "export",
        resourceId: "pdf",
        metadata: {
          dateFrom: from,
          dateTo: to,
          recordCount: snapshot.size,
          filename: filename || null,
        },
        createdAt: FieldValue.serverTimestamp(),
      })
      .catch((err) => console.error("audit log write failed:", err));

    return NextResponse.json({ report });
  } catch (error) {
    console.error("POST /api/export/pdf error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
