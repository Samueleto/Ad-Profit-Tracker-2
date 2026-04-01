import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyInternalSecret } from "@/lib/firebase-admin/verify-internal-secret";

export async function GET(request: Request) {
  const authError = verifyInternalSecret(request);
  if (authError) return authError;

  try {
    // Fetch recent sync audit log entries to summarise health
    const snapshot = await adminDb
      .collection("auditLogs")
      .where("action", "in", ["sync_completed", "sync_failed"])
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    let completed = 0;
    let failed = 0;
    let lastCompletedAt: string | null = null;

    snapshot.forEach((doc) => {
      const d = doc.data();
      if (d.action === "sync_completed") {
        completed++;
        if (!lastCompletedAt) {
          const ts = d.createdAt;
          lastCompletedAt = ts?.toDate ? ts.toDate().toISOString() : null;
        }
      } else {
        failed++;
      }
    });

    return NextResponse.json({
      status: "ok",
      checkedAt: new Date().toISOString(),
      recentWindow: { completed, failed, total: completed + failed },
      lastCompletedAt,
    });
  } catch (error) {
    console.error("GET /api/scheduled/health error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
