import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

// cron expression → human-readable label (best-effort)
function describeSchedule(cron: string | undefined): string {
  if (!cron) return 'Daily';
  if (cron === '0 0 * * *' || cron === '@daily') return 'Daily';
  if (cron === '0 * * * *' || cron === '@hourly') return 'Hourly';
  if (cron === '0 0 * * 0' || cron === '@weekly') return 'Weekly';
  return cron;
}

// Derive the next scheduled run time from a cron string (approximation: +24h for daily, +1h for hourly)
function nextRunAt(cron: string | undefined, lastSyncedAt: string | null): string | null {
  if (!lastSyncedAt) return null;
  const base = new Date(lastSyncedAt);
  if (isNaN(base.getTime())) return null;
  const isHourly = cron === '0 * * * *' || cron === '@hourly';
  const offsetMs = isHourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(base.getTime() + offsetMs).toISOString();
}

export interface ScheduledNetworkStatus {
  networkId: string;
  isActive: boolean;
  syncSchedule: string;
  lastSyncedAt: string | null;
  lastSyncStatus: 'success' | 'failed' | 'partial' | 'never';
  lastSyncError: string | null;
  latestDataDate: string | null;
  nextScheduledSync: string | null;
}

export interface SyncStatusResponse {
  networks: ScheduledNetworkStatus[];
  lastMasterSyncAt: string | null;
}

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    // Fetch all scheduled syncs for this user
    const schedulesSnap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('scheduledSyncs')
      .get();

    // Fetch all networkConfigs in parallel
    const networkIds: string[] = [];
    const scheduleMap: Record<string, { enabled: boolean; cron?: string }> = {};

    for (const doc of schedulesSnap.docs) {
      const data = doc.data();
      const networkId = data.networkId as string;
      if (!networkId) continue;
      networkIds.push(networkId);
      scheduleMap[networkId] = {
        enabled: data.enabled ?? false,
        cron: data.cron ?? data.syncSchedule ?? undefined,
      };
    }

    // Fetch networkConfig docs in parallel
    const configDocs = await Promise.all(
      networkIds.map(nid =>
        adminDb
          .collection('users')
          .doc(uid)
          .collection('networkConfigs')
          .doc(nid)
          .get()
      )
    );

    const networks: ScheduledNetworkStatus[] = networkIds.map((networkId, i) => {
      const config = configDocs[i].exists ? configDocs[i].data()! : {};
      const schedule = scheduleMap[networkId];
      const cron = schedule.cron;

      const rawLastSyncedAt = config.lastSyncedAt;
      const lastSyncedAt: string | null =
        rawLastSyncedAt?.toDate?.()?.toISOString?.() ??
        (typeof rawLastSyncedAt === 'string' ? rawLastSyncedAt : null);

      const rawStatus = config.lastSyncStatus as string | undefined;
      const lastSyncStatus: ScheduledNetworkStatus['lastSyncStatus'] =
        rawStatus === 'success' || rawStatus === 'failed' || rawStatus === 'partial'
          ? rawStatus
          : 'never';

      const rawLatestData = config.latestDataDate ?? config.lastDataDate ?? null;

      return {
        networkId,
        isActive: schedule.enabled,
        syncSchedule: describeSchedule(cron),
        lastSyncedAt,
        lastSyncStatus,
        lastSyncError: config.lastSyncError ?? null,
        latestDataDate: typeof rawLatestData === 'string' ? rawLatestData : null,
        nextScheduledSync: schedule.enabled ? nextRunAt(cron, lastSyncedAt) : null,
      };
    });

    // lastMasterSyncAt = most recent lastSyncedAt across all active networks
    let lastMasterSyncAt: string | null = null;
    for (const n of networks) {
      if (n.lastSyncedAt && (!lastMasterSyncAt || n.lastSyncedAt > lastMasterSyncAt)) {
        lastMasterSyncAt = n.lastSyncedAt;
      }
    }

    return NextResponse.json({ networks, lastMasterSyncAt } satisfies SyncStatusResponse);
  } catch (error) {
    console.error('GET /api/scheduled/sync-status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
