import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

// In-memory rate limit: 20 updates per hour per uid
const updateRateLimit = new Map<string, { count: number; resetAt: number }>();

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get("networkId");

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    const baseRef = adminDb.collection("users").doc(uid).collection("networkConfigs");
    const snapshot = networkId
      ? await baseRef.doc(networkId).get().then(d => ({ docs: d.exists ? [d] : [] }))
      : await baseRef.get();

    const configs = snapshot.docs.map((doc) => {
      const data = doc.data()!;
      return {
        networkId: doc.id,
        retryAttempts: data.retryAttempts ?? 3,
        timeoutSeconds: data.timeoutSeconds ?? 30,
        isActive: data.isActive ?? false,
      };
    });

    return NextResponse.json({ configs });
  } catch (error) {
    console.error("GET /api/errors/retry-config error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit: 20 updates per hour
  const now = Date.now();
  const entry = updateRateLimit.get(uid);
  if (entry && now < entry.resetAt && entry.count >= 20) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 20 retry config updates per hour." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    updateRateLimit.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    entry.count++;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { networkId, retryAttempts, timeoutSeconds } = body as {
      networkId?: string;
      retryAttempts?: unknown;
      timeoutSeconds?: unknown;
    };

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Valid networkId is required" }, { status: 400 });
    }

    // Validate retryAttempts: integer 1-5
    if (retryAttempts !== undefined) {
      const v = Number(retryAttempts);
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        return NextResponse.json(
          { error: "retryAttempts must be an integer between 1 and 5" },
          { status: 400 }
        );
      }
    }

    // Validate timeoutSeconds: integer 5-60
    if (timeoutSeconds !== undefined) {
      const v = Number(timeoutSeconds);
      if (!Number.isInteger(v) || v < 5 || v > 60) {
        return NextResponse.json(
          { error: "timeoutSeconds must be an integer between 5 and 60" },
          { status: 400 }
        );
      }
    }

    // Direct subcollection lookup — ownership guaranteed by uid path
    const configRef = adminDb.collection("users").doc(uid).collection("networkConfigs").doc(networkId);
    const configDoc = await configRef.get();

    if (!configDoc.exists) {
      return NextResponse.json({ error: "Network config not found" }, { status: 404 });
    }

    const before = { retryAttempts: configDoc.data()!.retryAttempts, timeoutSeconds: configDoc.data()!.timeoutSeconds };
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (retryAttempts !== undefined) updates.retryAttempts = Number(retryAttempts);
    if (timeoutSeconds !== undefined) updates.timeoutSeconds = Number(timeoutSeconds);

    await configRef.update(updates);

    // Audit log — fire-and-forget
    adminDb.collection("auditLogs").add({
      userId: uid,
      action: "retry_config_updated",
      networkId,
      details: {
        before,
        after: {
          retryAttempts: updates.retryAttempts ?? before.retryAttempts,
          timeoutSeconds: updates.timeoutSeconds ?? before.timeoutSeconds,
        },
      },
      createdAt: FieldValue.serverTimestamp(),
    }).catch((err: Error) => console.error("Audit log write failed:", err));

    return NextResponse.json({ success: true, networkId, updated: updates });
  } catch (error) {
    console.error("PATCH /api/errors/retry-config error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
