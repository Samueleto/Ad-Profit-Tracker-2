import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

const ALLOWED_FIELDS = ["displayName", "preferences", "onboardingCompletedAt", "onboardingSkipped"];

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  const { token } = authResult;
  const uid = token.uid;

  try {
    const body = await request.json();

    // Check for disallowed fields
    const unknownFields = Object.keys(body).filter((k) => !ALLOWED_FIELDS.includes(k));
    if (unknownFields.length > 0) {
      return NextResponse.json(
        { error: `Unknown fields: ${unknownFields.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate displayName
    if (body.displayName !== undefined) {
      if (typeof body.displayName !== "string" || body.displayName.length > 100) {
        return NextResponse.json(
          { error: "displayName must be a string with max 100 characters" },
          { status: 400 }
        );
      }
    }

    // Validate preferences
    if (body.preferences !== undefined) {
      const allowed = ["defaultDateRange", "timezone", "currency", "notifications"];
      const unknownPrefs = Object.keys(body.preferences).filter((k) => !allowed.includes(k));
      if (unknownPrefs.length > 0) {
        return NextResponse.json(
          { error: `Unknown preference fields: ${unknownPrefs.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.preferences !== undefined) {
      // Use dot notation to merge preferences without overwriting
      for (const [key, value] of Object.entries(body.preferences)) {
        updateData[`preferences.${key}`] = value;
      }
    }
    if (body.onboardingCompletedAt === "serverTimestamp") {
      updateData.onboardingCompletedAt = FieldValue.serverTimestamp();
    }
    if (body.onboardingSkipped !== undefined) {
      updateData.onboardingSkipped = body.onboardingSkipped;
    }

    const userRef = adminDb.collection("users").doc(uid);
    await userRef.update(updateData);

    const updatedDoc = await userRef.get();
    const data = updatedDoc.data()!;

    return NextResponse.json({
      uid: data.uid,
      displayName: data.displayName,
      preferences: data.preferences,
      lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString() || null,
    });
  } catch (error) {
    console.error("update-profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
