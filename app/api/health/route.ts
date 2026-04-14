import { NextResponse } from "next/server";
import { adminDb, adminCredentialsConfigured } from "@/lib/firebase-admin/admin";
import type { HealthResponseOk, HealthResponseError } from "@/lib/deployment/types";

const FIRESTORE_TIMEOUT_MS = 2000;

export async function GET() {
  const start = Date.now();
  try {
    await Promise.race([
      adminDb.collection("_health").limit(1).get(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore health check timed out')), FIRESTORE_TIMEOUT_MS)
      ),
    ]);
    const firestoreLatencyMs = Date.now() - start;

    const mem = process.memoryUsage();
    const memoryMB = Math.round(mem.rss / 1024 / 1024);
    const uptime = Math.floor(process.uptime());
    const version = process.env.npm_package_version || process.env.APP_VERSION || '1.0.0';

    const firestore: 'ok' | 'slow' = firestoreLatencyMs > 2000 ? 'slow' : 'ok';
    const status: 'healthy' | 'degraded' = firestore === 'slow' ? 'degraded' : 'healthy';

    const body: HealthResponseOk = { status, firestore, firestoreLatencyMs, memoryMB, uptime, version, credentialsConfigured: adminCredentialsConfigured };
    return NextResponse.json(body);
  } catch (error) {
    console.error("Health check failed:", error);
    const body: HealthResponseError = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Health check failed",
      credentialsConfigured: adminCredentialsConfigured,
    };
    return NextResponse.json(body, { status: 503 });
  }
}
