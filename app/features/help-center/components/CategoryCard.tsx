'use client';

import { HelpCircle, Code, AlertTriangle, Play, Settings, User } from 'lucide-react';
import type { HelpCategory } from '../types';

const ICONS: Record<string, React.ReactNode> = {
  faq: <HelpCircle className="w-5 h-5" />,
  api_guide: <Code className="w-5 h-5" />,
  troubleshooting: <AlertTriangle className="w-5 h-5" />,
  video_tutorial: <Play className="w-5 h-5" />,
  network_setup: <Settings className="w-5 h-5" />,
  account: <User className="w-5 h-5" />,
};

interface CategoryCardProps {
  category: HelpCategory;
  label: string;
  count: number;
  selected: boolean;
  onSelect: (category: HelpCategory) => void;
}

export default function CategoryCard({ category, label, count, selected, onSelect }: CategoryCardProps) {
  return (
    <button
      onClick={() => onSelect(category)}
      className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all text-center w-full ${
        selected
          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      aria-pressed={selected}
    >
      <span className={selected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}>
        {ICONS[category]}
      </span>
      <span className="text-xs font-semibold">{label}</span>
      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
        selected
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
      }`}>
        {count}
      </span>
    </button>
  );
}
