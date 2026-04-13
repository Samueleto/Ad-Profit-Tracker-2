import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";

// In-memory rate limit: 20 rule updates per hour per uid
const patchRateLimit = new Map<string, { count: number; resetAt: number }>();

const SUPPORTED_NETWORK_IDS = ["exoclick", "rollerads", "zeydoo", "propush"] as const;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const [rulesSnap, thresholdsDoc] = await Promise.all([
      adminDb
        .collection("reconciliationRules")
        .where("uid", "==", uid)
        .orderBy("createdAt", "desc")
        .get(),
      adminDb.collection("users").doc(uid).get(),
    ]);

    const rules = rulesSnap.docs.map(serializeDoc);

    // Build per-network threshold groups for ValidationRulesEditor
    const storedThresholds = (thresholdsDoc.data()?.validationThresholds ?? {}) as Record<string, unknown>;
    const networks = SUPPORTED_NETWORK_IDS.map((networkId) => ({
      networkId,
      rules: (storedThresholds[networkId] ?? {}) as Record<string, unknown>,
      isCustom: !!storedThresholds[networkId],
      updatedAt: null,
    }));

    return NextResponse.json({ rules, networks });
  } catch (error) {
    console.error("GET /api/reconciliation/rules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { name, condition, adjustment, networkId, enabled = true } = body;

    if (!name || !condition) {
      return NextResponse.json({ error: "name and condition are required" }, { status: 400 });
    }

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    const ref = await adminDb.collection("reconciliationRules").add({
      uid,
      name,
      condition,
      adjustment: adjustment || null,
      networkId: networkId || null,
      enabled,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const doc = await ref.get();
    return NextResponse.json({ rule: serializeDoc(doc) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/reconciliation/rules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit: 20 rule updates per hour
  const now = Date.now();
  const entry = patchRateLimit.get(uid);
  if (entry && now < entry.resetAt && entry.count >= 20) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 20 rule updates per hour." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    patchRateLimit.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    entry.count++;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { ruleId, name, condition, adjustment, networkId, enabled, rules } = body as Record<string, unknown>;

    // Threshold format from ValidationRulesEditor: { networkId, rules: {...thresholds} }
    if (!ruleId && networkId && rules && typeof rules === "object") {
      if (!isValidNetworkId(String(networkId))) {
        return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
      }
      await adminDb.collection("users").doc(uid).set(
        { validationThresholds: { [String(networkId)]: rules } },
        { merge: true }
      );
      return NextResponse.json({
        success: true,
        networkId,
        rules,
        isCustom: true,
        updatedAt: new Date().toISOString(),
      });
    }

    if (!ruleId || typeof ruleId !== "string") {
      return NextResponse.json({ error: "ruleId is required" }, { status: 400 });
    }

    if (networkId !== undefined && networkId !== null && !isValidNetworkId(String(networkId))) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    const doc = await adminDb.collection("reconciliationRules").doc(ruleId).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const allowed = ["name", "condition", "adjustment", "networkId", "enabled"];
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    const inputBody = { name, condition, adjustment, networkId, enabled };

    for (const key of allowed) {
      if ((inputBody as Record<string, unknown>)[key] !== undefined) {
        updates[key] = (inputBody as Record<string, unknown>)[key];
      }
    }

    await doc.ref.update(updates);
    const updated = await doc.ref.get();

    return NextResponse.json({ rule: serializeDoc(updated) });
  } catch (error) {
    console.error("PATCH /api/reconciliation/rules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
