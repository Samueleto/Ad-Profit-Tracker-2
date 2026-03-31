import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

// ─── Rate limiters ────────────────────────────────────────────────────────────

const getRateLimit = new Map<string, { count: number; resetAt: number }>();
const postRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkLimit(
  map: Map<string, { count: number; resetAt: number }>,
  uid: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = map.get(uid);
  if (!entry || now >= entry.resetAt) {
    map.set(uid, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= max) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

// ─── Metadata sanitizer ───────────────────────────────────────────────────────

const SENSITIVE_KEY_RE = /key|token|secret|password/i;

export function sanitizeMetadata(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(k)) continue; // strip sensitive fields
    result[k] = v;
  }
  return result;
}

// ─── GET /api/audit-logs ──────────────────────────────────────────────────────

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const { allowed, retryAfterSec } = checkLimit(getRateLimit, uid, 60, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 60 requests per minute." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    // userId from query params is intentionally ignored — always use verified token uid
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const networkId = searchParams.get("networkId");
    const action = searchParams.get("action");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = adminDb
      .collection("auditLogs")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(limit) as FirebaseFirestore.Query;

    if (networkId) {
      query = adminDb
        .collection("auditLogs")
        .where("userId", "==", uid)
        .where("networkId", "==", networkId)
        .orderBy("createdAt", "desc")
        .limit(limit);
    }

    const snapshot = await query.get();

    let logs = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        action: data.action,
        networkId: data.networkId,
        details: data.details,
        createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() || null,
      };
    });

    // Strict in-memory filters — action uses exact equality to prevent bypass
    if (action) {
      logs = logs.filter((log) => log.action === action);
    }
    if (startDate) {
      logs = logs.filter((log) => log.createdAt && log.createdAt >= startDate);
    }
    if (endDate) {
      logs = logs.filter((log) => log.createdAt && log.createdAt <= endDate + "T23:59:59Z");
    }

    return NextResponse.json({ logs, total: logs.length });
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/audit-logs ─────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const { allowed, retryAfterSec } = checkLimit(postRateLimit, uid, 60, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 60 log writes per minute." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();
    const { action, networkId, metadata } = body as {
      action?: string;
      networkId?: string;
      metadata?: unknown;
    };

    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    // Extract IP server-side — never from client body or headers the client controls
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Sanitize metadata — strip any field whose key contains key/token/secret/password
    const safeMetadata = metadata ? sanitizeMetadata(metadata) : null;

    const logRef = await adminDb.collection("auditLogs").add({
      userId: uid,
      action,
      networkId: networkId || null,
      metadata: safeMetadata,
      ipAddress,
      userAgent,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: logRef.id, success: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/audit-logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
