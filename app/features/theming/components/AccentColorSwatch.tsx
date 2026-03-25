"use client";

import { Check } from "lucide-react";

interface AccentColorSwatchProps {
  color: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}

export default function AccentColorSwatch({ color, label, selected, onClick }: AccentColorSwatchProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
        selected ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-300 scale-110" : "hover:scale-105"
      }`}
      style={{ backgroundColor: color }}
    >
      {selected && <Check className="w-4 h-4 text-white drop-shadow" aria-hidden="true" />}
    </button>
  );
}
