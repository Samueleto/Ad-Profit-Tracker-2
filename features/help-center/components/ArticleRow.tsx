'use client';

import Link from 'next/link';
import type { HelpArticleListItem, HelpCategory } from '../types';

const CATEGORY_COLORS: Record<HelpCategory, string> = {
  faq: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  api_guide: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  troubleshooting: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  video_tutorial: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  network_setup: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  account: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

const CATEGORY_LABELS: Record<HelpCategory, string> = {
  faq: 'FAQ',
  api_guide: 'API Guide',
  troubleshooting: 'Troubleshooting',
  video_tutorial: 'Video',
  network_setup: 'Network Setup',
  account: 'Account',
};

export default function ArticleRow({ article }: { article: HelpArticleListItem }) {
  return (
    <Link
      href={`/help/${article.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-lg group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate transition-colors">
            {article.title}
          </span>
          {article.isNew && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex-shrink-0">
              New
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`px-1.5 py-0.5 text-[11px] font-medium rounded-full ${CATEGORY_COLORS[article.category]}`}>
          {CATEGORY_LABELS[article.category]}
        </span>
        <span className="text-xs text-gray-400 whitespace-nowrap">{article.readTimeMinutes} min</span>
      </div>
    </Link>
  );
}
