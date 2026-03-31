import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

const ALLOWED_TOP_FIELDS = ["displayName", "preferences", "onboardingCompletedAt", "onboardingSkipped"];
const ALLOWED_PREF_FIELDS = ["defaultDateRange", "timezone", "currency", "notifications"];
const VALID_DATE_RANGES = new Set(["last7days", "last30days", "thisMonth"]);

// IANA timezone validation using built-in Intl API (Node.js 12.20+)
function isValidIANATimezone(tz: string): boolean {
  try {
    // Intl.supportedValuesOf is available in Node 18+; fall back to DateTimeFormat
    if (typeof (Intl as unknown as Record<string, unknown>).supportedValuesOf === "function") {
      return ((Intl as unknown as Record<string, (s: string) => string[]>).supportedValuesOf("timeZone") as string[]).includes(tz);
    }
    // Fallback: attempt to create a formatter with the given timezone
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const body = await request.json();

    // Reject unknown top-level fields
    const unknownFields = Object.keys(body).filter((k) => !ALLOWED_TOP_FIELDS.includes(k));
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

    // Validate onboardingSkipped — strict boolean only
    if (body.onboardingSkipped !== undefined) {
      if (typeof body.onboardingSkipped !== "boolean") {
        return NextResponse.json(
          { error: "onboardingSkipped must be a boolean" },
          { status: 400 }
        );
      }
    }

    // Validate preferences
    if (body.preferences !== undefined) {
      const unknownPrefs = Object.keys(body.preferences).filter((k) => !ALLOWED_PREF_FIELDS.includes(k));
      if (unknownPrefs.length > 0) {
        return NextResponse.json(
          { error: `Unknown preference fields: ${unknownPrefs.join(", ")}` },
          { status: 400 }
        );
      }

      // Validate timezone against IANA list
      if (body.preferences.timezone !== undefined) {
        if (typeof body.preferences.timezone !== "string" || !isValidIANATimezone(body.preferences.timezone)) {
          return NextResponse.json(
            { error: "preferences.timezone must be a valid IANA timezone string" },
            { status: 400 }
          );
        }
      }

      // Validate defaultDateRange against allowlist
      if (body.preferences.defaultDateRange !== undefined) {
        if (!VALID_DATE_RANGES.has(body.preferences.defaultDateRange)) {
          return NextResponse.json(
            { error: "preferences.defaultDateRange must be one of: last7days, last30days, thisMonth" },
            { status: 400 }
          );
        }
      }
    }

    // Build update — uid always comes from verified token, never from request body
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.displayName !== undefined) updateData.displayName = body.displayName;

    if (body.preferences !== undefined) {
      // Dot-notation partial updates — does not overwrite unrelated preference fields
      for (const [key, value] of Object.entries(body.preferences)) {
        updateData[`preferences.${key}`] = value;
      }
    }

    // onboardingCompletedAt: client sends the string 'serverTimestamp' as a signal;
    // server generates the actual timestamp — client-provided timestamps are ignored
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
