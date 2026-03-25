import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";

export async function GET() {
  try {
    // Check Firestore connectivity
    await adminDb.collection("_health").limit(1).get();

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        firestore: "connected",
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        services: {
          firestore: "disconnected",
        },
        error: "Health check failed",
      },
      { status: 503 }
    );
  }
}
