import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { to, subject, templateId, templateData, body: emailBody } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: "to and subject are required" }, { status: 400 });
    }

    // Log email send request (actual sending would use a service like SendGrid/Resend)
    const emailRef = await adminDb.collection("emailLogs").add({
      uid,
      to,
      subject,
      templateId: templateId || null,
      templateData: templateData || null,
      body: emailBody || null,
      status: "queued",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, emailId: emailRef.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/emails/send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
