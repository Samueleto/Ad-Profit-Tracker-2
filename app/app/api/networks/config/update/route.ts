import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

// Fields that can be updated through this endpoint.
// dataRole, userId, and createdAt are explicitly excluded (silently filtered).
const ALLOWED_FIELDS = new Set([
  "isActive",
  "syncSchedule",
  "endpointOverride",
  "timeoutSeconds",
  "retryAttempts",
  "displayOrder",
]);

// In-memory rate limit: 30 updates per minute per uid
const updateRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = updateRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    updateRateLimit.set(uid, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

// Private/internal IP ranges that must not be used as endpointOverride targets (SSRF prevention)
const PRIVATE_IP_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0\.0\.0\.0)/i;

function isValidEndpointOverride(value: unknown): boolean {
  if (value === null) return true; // null = use default endpoint
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false; // reject plain HTTP and other protocols
    const hostname = url.hostname;
    if (PRIVATE_IP_RE.test(hostname)) return false; // reject private/internal addresses
    return true;
  } catch {
    return false; // not a valid URL
  }
}

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  if (!checkRateLimit(uid)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 30 config updates per minute." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { networkId, ...updates } = body as { networkId: string; [key: string]: unknown };

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid or missing networkId" }, { status: 400 });
    }

    // Validate endpointOverride before filtering
    if ("endpointOverride" in updates && !isValidEndpointOverride(updates.endpointOverride)) {
      return NextResponse.json(
        { error: "endpointOverride must be null or a well-formed HTTPS URL pointing to a public host" },
        { status: 400 }
      );
    }

    // Apply field whitelist — dataRole, userId, createdAt are silently ignored
    const filteredUpdates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in updates) filteredUpdates[key] = updates[key];
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    filteredUpdates.updatedAt = FieldValue.serverTimestamp();

    const configRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("networkConfigs")
      .doc(networkId);

    await configRef.set(filteredUpdates, { merge: true });

    const updated = await configRef.get();
    const data = updated.data() ?? {};
    // Never return encryptedKey or raw API key in response
    const { encryptedKey: _ek, ...safeData } = data as Record<string, unknown>;
    return NextResponse.json({ config: { id: updated.id, ...safeData } });
  } catch (error) {
    console.error("PATCH /api/networks/config/update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
