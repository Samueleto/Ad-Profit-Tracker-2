import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

const MAX_PRESETS = 20;

// In-memory rate limits
const saveRateLimit = new Map<string, { count: number; resetAt: number }>();
const deleteRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  map: Map<string, { count: number; resetAt: number }>,
  uid: string,
  max: number
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = map.get(uid);
  if (entry && now < entry.resetAt && entry.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  if (!entry || now >= entry.resetAt) {
    map.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    entry.count++;
  }
  return { allowed: true, retryAfter: 0 };
}

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const snapshot = await adminDb
      .collection("savedFilters")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .get();

    return NextResponse.json({ filters: snapshot.docs.map(serializeDoc) });
  } catch (error) {
    console.error("GET /api/filters/saved error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit: 20 saves per hour
  const { allowed, retryAfter } = checkRateLimit(saveRateLimit, uid, 20);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 20 preset saves per hour." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { name, filters } = body as { name?: unknown; filters?: unknown };

    // Validate name: 1-50 chars
    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 50) {
      return NextResponse.json({ error: "name must be between 1 and 50 characters" }, { status: 400 });
    }

    if (!filters) {
      return NextResponse.json({ error: "filters is required" }, { status: 400 });
    }

    // Enforce 20-preset-per-user cap
    const existingSnapshot = await adminDb
      .collection("savedFilters")
      .where("uid", "==", uid)
      .get();

    if (existingSnapshot.size >= MAX_PRESETS) {
      return NextResponse.json(
        { error: `Preset limit reached. Maximum ${MAX_PRESETS} saved filters allowed.` },
        { status: 400 }
      );
    }

    const ref = await adminDb.collection("savedFilters").add({
      uid,
      name: name.trim(),
      filters,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const doc = await ref.get();
    return NextResponse.json({ filter: serializeDoc(doc) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/filters/saved error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
