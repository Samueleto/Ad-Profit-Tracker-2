'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TeamManagementPage from '@/features/team/components/TeamManagementPage';
import NetworkConfigTab from '@/features/network-config/components/NetworkConfigTab';
import ActivityLogTab from '@/features/audit-log/components/ActivityLogTab';
import ThemeSettingsSection from '@/features/theming/components/ThemeSettingsSection';

type SettingsTab = 'general' | 'team' | 'networks' | 'activity' | 'appearance';

const VALID_TABS: SettingsTab[] = ['general', 'team', 'networks', 'activity', 'appearance'];

function isValidTab(t: string | null): t is SettingsTab {
  return VALID_TABS.includes(t as SettingsTab);
}

interface SettingsTabsClientProps {
  children: React.ReactNode; // The general settings content (server-rendered)
}

export default function SettingsTabsClient({ children }: SettingsTabsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    isValidTab(tabParam) ? tabParam : 'general'
  );

  // Sync tab state when URL param changes (e.g. direct navigation to ?tab=networks)
  useEffect(() => {
    if (isValidTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'general') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.replace(`/settings${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your API keys, preferences, network configurations, and more.
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {([
            { id: 'general' as const, label: 'General' },
            { id: 'team' as const, label: 'Team' },
            { id: 'networks' as const, label: 'Networks' },
            { id: 'activity' as const, label: 'Activity Log' },
            { id: 'appearance' as const, label: 'Appearance' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'general' && children}
      {activeTab === 'team' && <TeamManagementPage />}
      {activeTab === 'networks' && <NetworkConfigTab />}
      {activeTab === 'activity' && <ActivityLogTab />}
      {activeTab === 'appearance' && <ThemeSettingsSection />}
    </div>
  );
}
