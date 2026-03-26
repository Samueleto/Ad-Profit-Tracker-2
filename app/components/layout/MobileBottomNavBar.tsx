'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Activity, Settings, FileText } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';

const TABS = [
  { id: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'networks', href: '/dashboard#networks', label: 'Networks', icon: Activity },
  { id: 'settings', href: '/settings', label: 'Settings', icon: Settings },
  { id: 'reports', href: '/reports', label: 'Reports', icon: FileText },
] as const;

export default function MobileBottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const health = useDashboardStore(s => s.health);

  // Show red badge on Networks tab when sync health is degraded or critical
  const showNetworkBadge = health === 'degraded' || health === 'critical';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(tab => {
        const isActive = tab.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname?.startsWith(tab.href.replace('#networks', ''));
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => router.push(tab.href)}
            className={`flex-1 flex flex-col items-center justify-center h-14 relative transition-colors ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="relative">
              <Icon className="w-6 h-6" />
              {tab.id === 'networks' && showNetworkBadge && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
