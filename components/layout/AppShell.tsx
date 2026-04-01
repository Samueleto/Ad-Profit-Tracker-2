"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  FileText,
  Users,
  HelpCircle,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Scale,
} from "lucide-react";
import { getAuth } from "firebase/auth";
import { useRateLimitConfig } from "@/features/rate-limits/hooks";

// Pre-warm rate limit config on app load so views have data immediately
function RateLimitConfigPreloader() {
  useRateLimitConfig();
  return null;
}
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/store/dashboardStore";
import MobileNavigationDrawer from "./MobileNavigationDrawer";
import MobileBottomNavBar from "./MobileBottomNavBar";
import BellIconTrigger from "@/features/notifications/components/BellIconTrigger";
import NotificationCenterPanel from "@/features/notifications/components/NotificationCenterPanel";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/team", label: "Team", icon: Users },
  { href: "/help", label: "Help", icon: HelpCircle },
];

async function fetchReconciliationBadge(): Promise<number> {
  try {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/reconciliation/status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data.networks ?? []).reduce(
      (sum: number, n: { anomalyCount?: number }) => sum + (n.anomalyCount ?? 0),
      0
    );
  } catch { return 0; }
}

function pathToTitle(path: string): string {
  if (path === "/dashboard") return "Dashboard";
  if (path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/reports")) return "Reports";
  if (path.startsWith("/team")) return "Team";
  if (path.startsWith("/help")) return "Help";
  if (path.startsWith("/onboarding")) return "Setup";
  if (path.startsWith("/reconciliation")) return "Reconciliation";
  return "Ad Profit Tracker";
}

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [reconciliationBadge, setReconciliationBadge] = useState(0);

  const hydrateBadgeFromFirestore = useDashboardStore(s => s.hydrateBadgeFromFirestore);

  useEffect(() => {
    setIsMounted(true);
    fetchReconciliationBadge().then(setReconciliationBadge);
    hydrateBadgeFromFirestore();
  }, [hydrateBadgeFromFirestore]);

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Mobile navigation drawer — only after hydration to prevent layout flash */}
      {isMounted && <MobileNavigationDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      {/* Legacy mobile sidebar overlay (md+ only) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 hidden md:block lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">AP</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              Ad Profit Tracker
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname?.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
          {/* Reconciliation — separate to support anomaly badge */}
          {(() => {
            const isActive = pathname?.startsWith("/reconciliation");
            return (
              <Link
                href="/reconciliation"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <Scale className="w-5 h-5 flex-shrink-0" />
                Reconciliation
                {reconciliationBadge > 0 && (
                  <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium bg-red-500 text-white rounded-full">
                    {reconciliationBadge > 99 ? '99+' : reconciliationBadge}
                  </span>
                )}
              </Link>
            );
          })()}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Mobile page title — updates on navigation */}
          <span className="lg:hidden ml-3 text-sm font-semibold text-gray-900 dark:text-white">
            {pathToTitle(pathname ?? "")}
          </span>

          <div className="flex-1 lg:flex-none" />

          {/* Bell icon */}
          <BellIconTrigger />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                  {user?.displayName?.[0] || user?.email?.[0] || "U"}
                </div>
              )}
              <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
                {user?.displayName || user?.email}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                  <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user?.displayName || "User"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-auto p-4 lg:p-6"
          style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav bar — only after hydration */}
      {isMounted && <MobileBottomNavBar />}

      {/* Notification slide-over panel */}
      <NotificationCenterPanel />

      {/* Pre-warm rate limit config */}
      <RateLimitConfigPreloader />
    </div>
  );
}
