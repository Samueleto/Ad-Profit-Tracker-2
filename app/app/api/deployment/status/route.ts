import { NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  try {
    const uptimeSeconds = Math.floor(process.uptime());
    const deployedAt = process.env.DEPLOY_TIMESTAMP || null;

    return NextResponse.json({
      service: process.env.SERVICE_NAME || 'ad-profit-tracker',
      revision: process.env.K_REVISION || 'local',
      region: process.env.FUNCTION_REGION || 'us-central1',
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds,
      nodeVersion: process.version,
      deployedAt,
    });
  } catch (error) {
    console.error('deployment/status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
