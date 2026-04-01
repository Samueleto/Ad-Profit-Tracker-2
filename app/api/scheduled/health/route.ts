import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyInternalSecret } from "@/lib/firebase-admin/verify-internal-secret";

export async function GET(request: Request) {
  const authError = verifyInternalSecret(request);
  if (authError) return authError;

  const checks: Record<string, "ok" | "error" | "missing"> = {};
  const checkedAt = new Date().toISOString();

  // Check required env vars
  const requiredEnvVars = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "INTERNAL_SECRET",
  ];
  let envOk = true;
  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      checks[`env.${key}`] = "missing";
      envOk = false;
    }
  }
  if (envOk) checks.env = "ok";

  // Check Firestore connectivity
  let firestoreOk = false;
  let completed = 0;
  let failed = 0;
  let lastCompletedAt: string | null = null;

  try {
    const snapshot = await adminDb
      .collection("auditLogs")
      .where("action", "in", ["sync_completed", "sync_failed"])
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

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

    checks.firestore = "ok";
    firestoreOk = true;
  } catch (error) {
    console.error("GET /api/scheduled/health Firestore error:", error);
    checks.firestore = "error";
  }

  const allOk = firestoreOk && envOk;

  if (!allOk) {
    return NextResponse.json(
      { status: "degraded", checkedAt, checks },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: "ok",
    checkedAt,
    checks,
    recentWindow: { completed, failed, total: completed + failed },
    lastCompletedAt,
  });
}
