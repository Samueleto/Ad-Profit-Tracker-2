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
    const networkIdFilter = searchParams.get("networkId");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    // userId == uid is always required — never return violations from other users
    let query = adminDb
      .collection("auditLogs")
      .where("userId", "==", uid)
      .where("action", "==", "rate_limit_exceeded") as FirebaseFirestore.Query;

    if (networkIdFilter) {
      query = query.where("networkId", "==", networkIdFilter);
    }

    let pagedQuery = query.orderBy("createdAt", "desc");

    if (cursor) {
      const cursorDoc = await adminDb.collection("auditLogs").doc(cursor).get();
      if (cursorDoc.exists) {
        pagedQuery = pagedQuery.startAfter(cursorDoc);
      }
    }

    const snapshot = await pagedQuery.limit(limit + 1).get();
    const hasMore = snapshot.docs.length > limit;
    const pageDocs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;
    let violations = pageDocs.map(serializeDoc);

    // Strict string equality check — cannot be bypassed by crafted values
    if (endpointFilter !== null) {
      violations = violations.filter((v) => {
        if (!v) return false;
        const row = v as Record<string, unknown>;
        return row.endpoint === endpointFilter;
      });
    }

    const nextCursor = hasMore && violations.length > 0
      ? (violations[violations.length - 1] as Record<string, unknown>)?.id as string ?? null
      : null;

    return NextResponse.json({ violations, total: violations.length, hasMore, nextCursor });
  } catch (error) {
    console.error("GET /api/rate-limits/violations error:", error);
    return NextResponse.json(
      { code: "FIRESTORE_READ_FAILURE", message: "Unable to load violations. Please try again." },
      { status: 500 }
    );
  }
}
