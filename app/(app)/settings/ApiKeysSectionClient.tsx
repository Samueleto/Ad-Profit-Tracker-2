'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import ApiKeyCard from '@/features/settings/components/ApiKeyCard';
import ApiKeyCardSkeleton from '@/features/settings/components/ApiKeyCardSkeleton';
import { Toast } from '@/components/ui/Toast';

interface NetworkKeyStatus {
  networkId: string;
  networkName: string;
  status: 'connected' | 'not_connected';
  updatedAt: string | null;
}

export default function ApiKeysSectionClient() {
  const [networks, setNetworks] = useState<NetworkKeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const getToken = useCallback(async (refresh = false) => {
    const auth = getAuth();
    return auth.currentUser?.getIdToken(refresh) ?? null;
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/keys/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      if (res.status === 401) {
        const token2 = await getToken(true);
        const res2 = await fetch('/api/keys/status', {
          headers: token2 ? { Authorization: `Bearer ${token2}` } : {},
          cache: 'no-store',
        });
        if (res2.ok) {
          const data = await res2.json();
          setNetworks(data?.networks ?? []);
        }
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setNetworks(data?.networks ?? []);
      }
    } catch {
      // silently fail — skeleton stays if networks empty
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSave = useCallback(async (networkId: string, key: string) => {
    setSubmittingId(networkId);
    try {
      let token = await getToken();
      const makeRequest = async (t: string | null) =>
        fetch('/api/keys/upsert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(t ? { Authorization: `Bearer ${t}` } : {}),
          },
          body: JSON.stringify({ networkId, apiKey: key }),
        });

      let res = await makeRequest(token);
      if (res.status === 401) {
        token = await getToken(true);
        res = await makeRequest(token);
      }
      if (res.ok) {
        setNetworks(prev =>
          prev.map(n =>
            n.networkId === networkId
              ? { ...n, status: 'connected', updatedAt: new Date().toISOString() }
              : n
          )
        );
        setToast({ message: 'API key saved successfully.', variant: 'success' });
      } else {
        setToast({ message: 'Failed to save API key. Please try again.', variant: 'error' });
      }
    } finally {
      setSubmittingId(null);
    }
  }, [getToken]);

  const handleDisconnect = useCallback(async (networkId: string) => {
    let token = await getToken();
    const makeRequest = async (t: string | null) =>
      fetch('/api/keys/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: JSON.stringify({ networkId }),
      });

    let res = await makeRequest(token);
    if (res.status === 401) {
      token = await getToken(true);
      res = await makeRequest(token);
    }
    if (res.ok) {
      setNetworks(prev =>
        prev.map(n =>
          n.networkId === networkId
            ? { ...n, status: 'not_connected', updatedAt: null }
            : n
        )
      );
      setToast({ message: 'Key disconnected.', variant: 'success' });
    } else {
      setToast({ message: 'Failed to disconnect key.', variant: 'error' });
    }
  }, [getToken]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ApiKeyCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {networks.map(network => (
          <ApiKeyCard
            key={network.networkId}
            networkId={network.networkId}
            networkName={network.networkName}
            status={network.status}
            updatedAt={network.updatedAt}
            isSubmitting={submittingId === network.networkId}
            onSave={handleSave}
            onDisconnect={handleDisconnect}
          />
        ))}
      </div>
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
