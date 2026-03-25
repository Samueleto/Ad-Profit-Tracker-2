import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import {
  DEFAULT_PREFERENCES,
  buildPreferencesUpdateObject,
  isValidTimezone,
  isValidCurrency,
  isValidDateRange,
} from "@/lib/preferences";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  const { token } = authResult;
  const uid = token.uid;

  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data = userDoc.data()!;
    const preferences = data.preferences || DEFAULT_PREFERENCES;

    return NextResponse.json({
      ...preferences,
      updatedAt: preferences.updatedAt?.toDate?.()?.toISOString() || null,
    });
  } catch (error) {
    console.error("preferences GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  const { token } = authResult;
  const uid = token.uid;

  try {
    const body = await request.json();

    // Validate each provided field
    if (body.timezone !== undefined && !isValidTimezone(body.timezone)) {
      return NextResponse.json(
        { error: `Invalid timezone: "${body.timezone}" is not a recognized IANA timezone` },
        { status: 400 }
      );
    }

    if (body.currency !== undefined && !isValidCurrency(body.currency)) {
      return NextResponse.json(
        { error: `Invalid currency: "${body.currency}" is not a valid ISO 4217 code` },
        { status: 400 }
      );
    }

    if (body.defaultDateRange !== undefined && !isValidDateRange(body.defaultDateRange)) {
      return NextResponse.json(
        {
          error: `Invalid defaultDateRange: "${body.defaultDateRange}". Must be one of: last_7_days, last_14_days, last_30_days, this_month`,
        },
        { status: 400 }
      );
    }

    if (body.notifications !== undefined) {
      if (
        body.notifications.dailySummaryEmail !== undefined &&
        typeof body.notifications.dailySummaryEmail !== "boolean"
      ) {
        return NextResponse.json(
          { error: "notifications.dailySummaryEmail must be a boolean" },
          { status: 400 }
        );
      }
      if (
        body.notifications.weeklyReportEmail !== undefined &&
        typeof body.notifications.weeklyReportEmail !== "boolean"
      ) {
        return NextResponse.json(
          { error: "notifications.weeklyReportEmail must be a boolean" },
          { status: 400 }
        );
      }
    }

    const updateObj = buildPreferencesUpdateObject(body);
    await adminDb.collection("users").doc(uid).update(updateObj);

    const updatedDoc = await adminDb.collection("users").doc(uid).get();
    const data = updatedDoc.data()!;
    const prefs = data.preferences || DEFAULT_PREFERENCES;

    return NextResponse.json({
      ...prefs,
      updatedAt: prefs.updatedAt?.toDate?.()?.toISOString() || null,
    });
  } catch (error) {
    console.error("preferences PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
