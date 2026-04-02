import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const endpointFilter = searchParams.get("endpoint");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    // userId == uid is always required — never return violations from other users
    const snapshot = await adminDb
      .collection("auditLogs")
      .where("userId", "==", uid)
      .where("action", "==", "rate_limit_exceeded")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    let violations = snapshot.docs.map(serializeDoc);

    // Strict string equality check — cannot be bypassed by crafted values
    if (endpointFilter !== null) {
      violations = violations.filter((v) => {
        if (!v) return false;
        const row = v as Record<string, unknown>;
        return row.endpoint === endpointFilter;
      });
    }

    return NextResponse.json({ violations, total: violations.length });
  } catch (error) {
    console.error("GET /api/rate-limits/violations error:", error);
    return NextResponse.json(
      { code: "FIRESTORE_READ_FAILURE", message: "Unable to load violations. Please try again." },
      { status: 500 }
    );
  }
}
