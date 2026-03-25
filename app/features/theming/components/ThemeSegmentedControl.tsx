"use client";

import { Sun, Moon, Monitor } from "lucide-react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeSegmentedControlProps {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
}

const options: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export default function ThemeSegmentedControl({ value, onChange }: ThemeSegmentedControlProps) {
  return (
    <div
      className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1"
      role="radiogroup"
      aria-label="Theme mode"
    >
      {options.map(({ value: optVal, label, Icon }) => {
        const isActive = value === optVal;
        return (
          <button
            key={optVal}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(optVal)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              isActive
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
