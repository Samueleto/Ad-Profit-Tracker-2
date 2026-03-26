'use client';

import { useState } from 'react';
import TeamManagementPage from '@/features/team/components/TeamManagementPage';
import NetworkConfigTab from '@/features/network-config/components/NetworkConfigTab';

type SettingsTab = 'general' | 'team' | 'networks';

interface SettingsTabsClientProps {
  children: React.ReactNode; // The general settings content (server-rendered)
}

export default function SettingsTabsClient({ children }: SettingsTabsClientProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

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
        <nav className="flex gap-1 -mb-px">
          {([
            { id: 'general' as const, label: 'General' },
            { id: 'team' as const, label: 'Team' },
            { id: 'networks' as const, label: 'Networks' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
    </div>
  );
}
