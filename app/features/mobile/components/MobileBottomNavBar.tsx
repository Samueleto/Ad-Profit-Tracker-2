"use client";

import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Activity, Settings, FileText } from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: "/dashboard" },
  { href: "/dashboard#networks", label: "Networks", icon: Activity, match: "#networks" },
  { href: "/settings", label: "Settings", icon: Settings, match: "/settings" },
  { href: "/reports", label: "Reports", icon: FileText, match: "/reports" },
];

interface MobileBottomNavBarProps {
  accentColor?: string;
  healthDegraded?: boolean;
}

export default function MobileBottomNavBar({
  accentColor = "#6366f1",
  healthDegraded = false,
}: MobileBottomNavBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-14">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const isActive = match.startsWith("/")
            ? pathname === match || pathname?.startsWith(match + "/")
            : pathname?.includes(match);
          const isNetworks = label === "Networks";

          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
              aria-label={label}
            >
              <div className="relative">
                <Icon
                  className="w-6 h-6"
                  style={{ color: isActive ? accentColor : "#9ca3af" }}
                />
                {isNetworks && healthDegraded && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
                )}
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? accentColor : "#9ca3af" }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
