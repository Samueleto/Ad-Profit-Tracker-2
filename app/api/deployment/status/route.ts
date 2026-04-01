import { NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { adminDb } from '@/lib/firebase-admin/admin';
import type { DeploymentStatusResponse } from '@/lib/deployment/types';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const { uid } = authResult.token;

  // Only owner and admin may view deployment status
  const userDoc = await adminDb.collection('users').doc(uid).get();
  const role = userDoc.data()?.workspaceRole;
  if (!userDoc.exists || (role !== 'owner' && role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const uptimeSeconds = Math.floor(process.uptime());
    const deployedAt = process.env.DEPLOY_TIMESTAMP || null;

    const body: DeploymentStatusResponse = {
      service: process.env.CLOUD_RUN_SERVICE_NAME || process.env.K_SERVICE || 'ad-profit-tracker',
      revision: process.env.K_REVISION || 'local',
      region: process.env.CLOUD_RUN_REGION || 'us-central1',
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds,
      nodeVersion: process.version,
      deployedAt,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error('deployment/status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
