import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

// In-memory rate limit: 5 exports per hour per uid
const exportRateLimit = new Map<string, { count: number; resetAt: number }>();
const EXPORT_MAX = 5;
const EXPORT_WINDOW_MS = 60 * 60 * 1000;

// Hard cap: never read more than 10,000 documents in a single export
const EXPORT_HARD_CAP = 10_000;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit check
  const now = Date.now();
  const entry = exportRateLimit.get(uid);
  if (entry && now < entry.resetAt && entry.count >= EXPORT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 5 exports per hour." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    exportRateLimit.set(uid, { count: 1, resetAt: now + EXPORT_WINDOW_MS });
  } else {
    entry.count++;
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const action = searchParams.get("action");
    const status = searchParams.get("status");
    const preset = searchParams.get("preset");
    const search = searchParams.get("search");

    // Resolve date range from explicit params or preset
    let startDate = searchParams.get("startDate");
    let endDate = searchParams.get("endDate");
    if (!startDate && !endDate && preset) {
      const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : null;
      if (days !== null) {
        const now = new Date();
        endDate = now.toISOString().slice(0, 10);
        const from = new Date(now);
        from.setDate(now.getDate() - days + 1);
        startDate = from.toISOString().slice(0, 10);
      }
    }

    // Hard cap enforced regardless of filters — userId always from verified token
    const snapshot = await adminDb
      .collection("auditLogs")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(EXPORT_HARD_CAP)
      .get();

    let logs = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        action: data.action as string,
        networkId: data.networkId || null,
        status: (data.status as string) ?? null,
        details: data.details ?? data.metadata ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    if (action) {
      const actions = action.split(",").map(s => s.trim()).filter(Boolean);
      logs = logs.filter((log) => actions.includes(log.action));
    }
    if (status) {
      logs = logs.filter((log) => log.status === status);
    }
    if (startDate) {
      logs = logs.filter((log) => log.createdAt && log.createdAt >= startDate!);
    }
    if (endDate) {
      logs = logs.filter((log) => log.createdAt && log.createdAt <= endDate! + "T23:59:59Z");
    }
    if (search) {
      const q = search.toLowerCase();
      logs = logs.filter((log) =>
        JSON.stringify(log.details ?? {}).toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q)
      );
    }

    if (format === "csv") {
      const header = "id,action,networkId,details,createdAt\n";
      const rows = logs.map((log) =>
        [
          log.id,
          log.action,
          log.networkId || "",
          JSON.stringify((log as Record<string, unknown>).details ?? ""),
          log.createdAt || "",
        ].join(",")
      );
      const csv = header + rows.join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="audit-logs.csv"',
        },
      });
    }

    return NextResponse.json({
      logs,
      total: logs.length,
      cappedAt: EXPORT_HARD_CAP,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/audit-logs/export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
