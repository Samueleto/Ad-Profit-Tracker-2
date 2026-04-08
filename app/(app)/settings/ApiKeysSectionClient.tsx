'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import ApiKeyCard from '@/features/settings/components/ApiKeyCard';
import ApiKeyCardSkeleton from '@/features/settings/components/ApiKeyCardSkeleton';
import { SUPPORTED_NETWORKS } from '@/lib/constants';

const NETWORK_LABELS: Record<string, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'ProPush',
};

const DEFAULT_NETWORKS: NetworkKeyStatus[] = SUPPORTED_NETWORKS.map(networkId => ({
  networkId,
  status: 'not_connected',
  updatedAt: null,
}));

interface NetworkKeyStatus {
  networkId: string;
  status: 'connected' | 'not_connected';
  updatedAt: string | null;
}

async function authFetch(
  path: string,
  init: RequestInit = {}
): Promise<{ res: Response; sessionExpired: boolean }> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken() ?? null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(path, { ...init, headers });
  if (res.status !== 401) return { res, sessionExpired: false };

  const freshToken = await auth.currentUser?.getIdToken(true).catch(() => null) ?? null;
  if (!freshToken) return { res, sessionExpired: true };
  const retryRes = await fetch(path, {
    ...init,
    headers: { ...headers, Authorization: `Bearer ${freshToken}` },
  });
  return { res: retryRes, sessionExpired: retryRes.status === 401 };
}

export default function ApiKeysSectionClient() {
  const router = useRouter();
  const [networks, setNetworks] = useState<NetworkKeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const handleSessionExpired = useCallback(() => {
    toast.error('Your session has expired. Please sign in again.');
    router.replace('/');
  }, [router]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setStatusError(false);
    try {
      // Wait for Firebase auth to initialize before fetching so we always have a token
      const auth = getAuth();
      if (!auth.currentUser) {
        await new Promise<void>((resolve) => {
          const unsub = onAuthStateChanged(auth, () => { unsub(); resolve(); });
        });
      }

      const { res, sessionExpired } = await authFetch('/api/keys/status', { cache: 'no-store' } as RequestInit);
      if (sessionExpired) { handleSessionExpired(); return; }
      if (!res.ok) { setStatusError(true); return; }
      const data: NetworkKeyStatus[] = await res.json();
      const list = Array.isArray(data) && data.length > 0 ? data : DEFAULT_NETWORKS;
      setNetworks(list);
    } catch {
      // Network error — show all networks as not_connected so the user can still add keys
      setNetworks(DEFAULT_NETWORKS);
    } finally {
      setLoading(false);
    }
  }, [handleSessionExpired]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSave = useCallback(async (networkId: string, key: string): Promise<void> => {
    setSubmittingId(networkId);
    setSaveErrors(prev => { const next = { ...prev }; delete next[networkId]; return next; });
    try {
      const { res, sessionExpired } = await authFetch('/api/keys/save', {
        method: 'POST',
        body: JSON.stringify({ networkId, key }),
      });
      if (sessionExpired) { handleSessionExpired(); return; }
      if (res.status === 400) {
        setSaveErrors(prev => ({ ...prev, [networkId]: 'Invalid API key format' }));
        return;
      }
      if (res.status === 429) {
        toast.warning('Too many attempts. Please wait a moment and try again.');
        return;
      }
      if (!res.ok) {
        toast.error('Something went wrong saving your key. Please try again.');
        return;
      }
      setNetworks(prev =>
        prev.map(n =>
          n.networkId === networkId
            ? { ...n, status: 'connected', updatedAt: new Date().toISOString() }
            : n
        )
      );
      toast.success('API key saved successfully.');
    } catch {
      toast.error('Connection error. Check your internet and try again.');
    } finally {
      setSubmittingId(null);
    }
  }, [handleSessionExpired]);

  const handleDisconnect = useCallback(async (networkId: string): Promise<void> => {
    // Optimistic update
    setNetworks(prev =>
      prev.map(n =>
        n.networkId === networkId ? { ...n, status: 'not_connected', updatedAt: null } : n
      )
    );
    try {
      const { res, sessionExpired } = await authFetch('/api/keys/delete', { method: 'DELETE', body: JSON.stringify({ networkId }) });
      if (sessionExpired) { handleSessionExpired(); return; }
      // 404 = already gone — treat as success (optimistic update stays)
      if (res.status === 404 || res.ok) {
        toast.success('Network disconnected.');
        return;
      }
      // Revert optimistic update on error
      setNetworks(prev =>
        prev.map(n =>
          n.networkId === networkId ? { ...n, status: 'connected' } : n
        )
      );
      toast.error('Unable to disconnect. Please try again.');
    } catch {
      // Revert on network error
      setNetworks(prev =>
        prev.map(n =>
          n.networkId === networkId ? { ...n, status: 'connected' } : n
        )
      );
      toast.error('Unable to disconnect. Please try again.');
    }
  }, [handleSessionExpired]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ApiKeyCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <span className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Unable to load connection status
        </span>
        <button
          onClick={fetchStatus}
          className="text-xs text-red-700 dark:text-red-400 underline hover:no-underline ml-3"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {networks.map(network => (
        <ApiKeyCard
          key={network.networkId}
          networkId={network.networkId}
          networkName={NETWORK_LABELS[network.networkId] ?? network.networkId}
          status={network.status}
          updatedAt={network.updatedAt}
          isSubmitting={submittingId === network.networkId}
          saveError={saveErrors[network.networkId] ?? null}
          onSave={handleSave}
          onDisconnect={handleDisconnect}
        />
      ))}
    </div>
  );
}
