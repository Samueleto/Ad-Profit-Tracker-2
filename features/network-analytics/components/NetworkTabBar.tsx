'use client';

type SyncStatus = 'success' | 'failed' | null;

interface NetworkTab {
  id: string;
  label: string;
  syncStatus?: SyncStatus;
}

interface NetworkTabBarProps {
  tabs: NetworkTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

function StatusDot({ status }: { status?: SyncStatus }) {
  const color =
    status === 'success' ? 'bg-green-500' :
    status === 'failed' ? 'bg-red-500' :
    'bg-gray-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export default function NetworkTabBar({ tabs, activeTab, onTabChange }: NetworkTabBarProps) {
  return (
    <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 gap-0">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {tab.syncStatus !== undefined && <StatusDot status={tab.syncStatus} />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
