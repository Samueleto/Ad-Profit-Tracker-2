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

function sanitizeMetadata(obj: unknown): unknown {
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
    const status = searchParams.get("status"); // 'success' | 'failure'
    const preset = searchParams.get("preset"); // '7d' | '30d' | '90d'
    const cursor = searchParams.get("cursor");

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

    let query = adminDb
      .collection("auditLogs")
      .where("userId", "==", uid) as FirebaseFirestore.Query;

    if (networkId) {
      query = query.where("networkId", "==", networkId);
    }

    query = query.orderBy("createdAt", "desc");

    // Cursor-based pagination: start after the cursor document
    if (cursor) {
      const cursorDoc = await adminDb.collection("auditLogs").doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    query = query.limit(limit + 1);

    const snapshot = await query.get();

    const hasMore = snapshot.docs.length > limit;
    const pageDocs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    let logs = pageDocs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        userId: data.userId ?? uid,
        action: data.action,
        resourceType: data.resourceType ?? null,
        resourceId: data.resourceId ?? null,
        networkId: data.networkId ?? null,
        metadata: data.details ?? data.metadata ?? null,
        details: data.details ?? data.metadata ?? null,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        status: data.status ?? null,
        errorMessage: data.errorMessage ?? null,
        createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() || null,
      };
    });

    // Support comma-separated action filter
    if (action) {
      const actions = action.split(",").map(s => s.trim()).filter(Boolean);
      logs = logs.filter((log) => actions.includes(String(log.action)));
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

    const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    return NextResponse.json({ logs, total: logs.length, hasMore, nextCursor });
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
      details: safeMetadata,
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
