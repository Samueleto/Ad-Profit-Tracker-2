"use client";

import { useState } from "react";
import AccentColorSwatch from "./AccentColorSwatch";

export const PRESET_COLORS = [
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#10b981", label: "Emerald" },
  { hex: "#f43f5e", label: "Rose" },
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#0ea5e9", label: "Sky" },
  { hex: "#8b5cf6", label: "Violet" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#64748b", label: "Slate" },
];

interface AccentColorPickerProps {
  selectedColor: string;
  onChange: (color: string) => void;
}

function isValidHex(value: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(value);
}

export default function AccentColorPicker({ selectedColor, onChange }: AccentColorPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [hexError, setHexError] = useState(false);

  const handleCustomInput = (val: string) => {
    setCustomInput(val);
    const withHash = val.startsWith("#") ? val : `#${val}`;
    if (isValidHex(val)) {
      setHexError(false);
      onChange(withHash.slice(0, 7));
    } else {
      setHexError(true);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {PRESET_COLORS.map(({ hex, label }) => (
          <AccentColorSwatch
            key={hex}
            color={hex}
            label={label}
            selected={selectedColor === hex}
            onClick={() => {
              onChange(hex);
              setShowCustom(false);
            }}
          />
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`px-3 py-1 text-sm rounded-md border transition-colors ${
            showCustom
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent"
              : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => handleCustomInput(e.target.value)}
            placeholder="#6366f1"
            maxLength={7}
            className={`w-32 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white ${
              hexError
                ? "border-red-400 dark:border-red-500"
                : "border-gray-300 dark:border-gray-600"
            }`}
          />
          {hexError && (
            <span className="text-sm text-red-500">Invalid hex color</span>
          )}
          {!hexError && customInput && (
            <div
              className="w-6 h-6 rounded-full border border-gray-200"
              style={{ backgroundColor: customInput.startsWith("#") ? customInput : `#${customInput}` }}
            />
          )}
        </div>
      )}
    </div>
  );
}
