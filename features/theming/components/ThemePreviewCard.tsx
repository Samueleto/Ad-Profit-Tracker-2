"use client";

import type { ThemeMode } from "./ThemeSegmentedControl";

interface ThemePreviewCardProps {
  themeMode: ThemeMode;
  accentColor: string;
}

export default function ThemePreviewCard({ themeMode, accentColor }: ThemePreviewCardProps) {
  const isDark = themeMode === "dark" || (themeMode === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const bg = isDark ? "#1f2937" : "#ffffff";
  const cardBg = isDark ? "#374151" : "#f9fafb";
  const textPrimary = isDark ? "#f9fafb" : "#111827";
  const textSecondary = isDark ? "#9ca3af" : "#6b7280";
  const border = isDark ? "#4b5563" : "#e5e7eb";

  return (
    <div
      className="rounded-lg border p-3 w-40 h-32 flex flex-col justify-between select-none"
      style={{ background: bg, borderColor: border }}
      aria-label={`Theme preview: ${themeMode}`}
    >
      {/* Mini KPI card */}
      <div className="rounded p-2" style={{ background: cardBg, border: `1px solid ${border}` }}>
        <p className="text-xs font-medium mb-1" style={{ color: textSecondary }}>Revenue</p>
        <p className="text-base font-bold" style={{ color: textPrimary }}>$12,450</p>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs font-medium" style={{ color: accentColor }}>↑ 8.2%</span>
          <span className="text-xs" style={{ color: textSecondary }}>vs prev</span>
        </div>
      </div>
      {/* Accent bar */}
      <div className="h-1.5 rounded-full mt-1" style={{ background: accentColor, opacity: 0.7 }} />
    </div>
  );
}
