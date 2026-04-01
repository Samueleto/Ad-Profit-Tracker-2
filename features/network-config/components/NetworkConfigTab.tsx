'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNetworkConfigs } from '../hooks/useNetworkConfigs';
import NetworkCard from './NetworkCard';
import { Toast } from '@/components/ui/Toast';
import type { NetworkConfig } from '../types';

const NETWORK_LABELS: Record<string, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'Propush',
};

function getConnectionStatus(config: NetworkConfig): 'connected' | 'not_connected' | 'error' {
  if (config.lastSyncStatus === 'failed') return 'error';
  if (config.lastSyncedAt) return 'connected';
  return 'not_connected';
}

// Sortable wrapper for each NetworkCard
function SortableNetworkCard({
  config,
  networkName,
  connectionStatus,
  onUpdate,
}: {
  config: NetworkConfig;
  networkName: string;
  connectionStatus: 'connected' | 'not_connected' | 'error';
  onUpdate: (networkId: string, update: Parameters<ReturnType<typeof useNetworkConfigs>['updateNetworkConfig']>[1]) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: config.networkId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle — the card header area */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <NetworkCard
          config={config}
          networkName={networkName}
          connectionStatus={connectionStatus}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  );
}

export default function NetworkConfigTab() {
  const router = useRouter();
  const {
    networks,
    loading,
    error,
    authExpired,
    syncAllLoading,
    syncAllResult,
    updateNetworkConfig,
    reorderNetworks,
    syncAll,
  } = useNetworkConfigs();

  const [syncToast, setSyncToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const [sessionToast, setSessionToast] = useState(false);

  // Handle auth expiry
  useEffect(() => {
    if (authExpired) {
      setSessionToast(true);
      const t = setTimeout(() => router.push('/'), 1500);
      return () => clearTimeout(t);
    }
  }, [authExpired, router]);

  // Show toast when syncAllResult changes
  useEffect(() => {
    if (!syncAllResult) return;
    const msg = `Synced: ${syncAllResult.triggered} | Skipped: ${syncAllResult.skipped} | Failed: ${syncAllResult.failed}`;
    setSyncToast({ message: msg, variant: syncAllResult.failed > 0 ? 'error' : 'success' });
  }, [syncAllResult]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = networks.findIndex(n => n.networkId === active.id);
    const newIndex = networks.findIndex(n => n.networkId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...networks];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    reorderNetworks(reordered);
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync All button */}
      <div className="flex justify-end">
        <button
          onClick={syncAll}
          disabled={syncAllLoading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {syncAllLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Sync All Now
        </button>
      </div>

      {/* Network cards — wrapped in DndContext for drag-to-reorder */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="h-8 w-full bg-gray-100 dark:bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={networks.map(n => n.networkId)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {networks.map(config => (
                <SortableNetworkCard
                  key={config.networkId}
                  config={config}
                  networkName={NETWORK_LABELS[config.networkId] ?? config.networkId}
                  connectionStatus={getConnectionStatus(config)}
                  onUpdate={updateNetworkConfig}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {syncToast && (
        <Toast message={syncToast.message} variant={syncToast.variant} onClose={() => setSyncToast(null)} />
      )}
      {sessionToast && (
        <Toast message="Session expired. Redirecting to login…" variant="error" onClose={() => setSessionToast(false)} />
      )}
    </div>
  );
}
