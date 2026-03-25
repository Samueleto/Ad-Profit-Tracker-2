import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const snapshot = await adminDb
      .collection("auditLogs")
      .where("uid", "==", uid)
      .orderBy("timestamp", "desc")
      .limit(1000)
      .get();

    let logs = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        action: data.action,
        networkId: data.networkId,
        details: data.details,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
      };
    });

    if (startDate) {
      logs = logs.filter((log) => log.timestamp && log.timestamp >= startDate);
    }
    if (endDate) {
      logs = logs.filter((log) => log.timestamp && log.timestamp <= endDate + "T23:59:59Z");
    }

    if (format === "csv") {
      const header = "id,action,networkId,details,timestamp\n";
      const rows = logs.map((log) =>
        [log.id, log.action, log.networkId || "", JSON.stringify(log.details || ""), log.timestamp || ""].join(",")
      );
      const csv = header + rows.join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="audit-logs.csv"',
        },
      });
    }

    return NextResponse.json({ logs, total: logs.length, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error("GET /api/audit-logs/export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
