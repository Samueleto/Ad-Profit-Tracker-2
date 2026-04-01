"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
  loading?: boolean;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}

export default function MetricCard({
  title,
  value,
  subtitle,
  trend,
  loading,
  icon,
  variant = "default",
}: MetricCardProps) {
  const variantStyles = {
    default: "border-gray-200 dark:border-gray-700",
    success: "border-green-200 dark:border-green-800",
    warning: "border-yellow-200 dark:border-yellow-800",
    danger: "border-red-200 dark:border-red-800",
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border p-5 ${variantStyles[variant]}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border p-5 ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white truncate">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="ml-3 flex-shrink-0 text-gray-400 dark:text-gray-500">{icon}</div>
        )}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          {trend.value > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : trend.value < 0 ? (
            <TrendingDown className="w-4 h-4 text-red-500" />
          ) : (
            <Minus className="w-4 h-4 text-gray-400" />
          )}
          <span
            className={`text-sm font-medium ${
              trend.value > 0
                ? "text-green-600 dark:text-green-400"
                : trend.value < 0
                ? "text-red-600 dark:text-red-400"
                : "text-gray-500"
            }`}
          >
            {trend.value > 0 ? "+" : ""}
            {trend.value.toFixed(1)}%
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
