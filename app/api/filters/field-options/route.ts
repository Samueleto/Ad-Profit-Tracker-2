import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { SUPPORTED_NETWORKS } from "@/lib/constants";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    // Get distinct countries from adStats
    const snapshot = await adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .limit(2000)
      .get();

    const countries = new Set<string>();
    const dateRange = { min: "", max: "" };

    for (const doc of snapshot.docs) {
      const d = doc.data();
      if (d.country) countries.add(d.country as string);
      if (d.date) {
        if (!dateRange.min || d.date < dateRange.min) dateRange.min = d.date;
        if (!dateRange.max || d.date > dateRange.max) dateRange.max = d.date;
      }
    }

    return NextResponse.json({
      networks: SUPPORTED_NETWORKS,
      countries: Array.from(countries).sort(),
      dateRange,
      fields: ["date", "networkId", "revenue", "cost", "impressions", "clicks", "ctr", "ecpm", "country"],
    });
  } catch (error) {
    console.error("GET /api/filters/field-options error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
