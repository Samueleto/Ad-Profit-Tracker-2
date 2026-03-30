'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Mail, X, AlertCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import CategoryCard from '@/features/help-center/components/CategoryCard';
import ArticleRow from '@/features/help-center/components/ArticleRow';
import PopularArticlesSidebar from '@/features/help-center/components/PopularArticlesSidebar';
import ArticleShimmer from '@/features/help-center/components/ArticleShimmer';
import type { HelpCategory, HelpArticleListItem, CategoryGroup, HelpSearchResult } from '@/features/help-center/types';
import { HELP_CATEGORIES } from '@/features/help-center/types';

const CATEGORY_LABELS: Record<HelpCategory, string> = {
  faq: 'FAQs',
  api_guide: 'API Guides',
  troubleshooting: 'Troubleshooting',
  video_tutorial: 'Video Tutorials',
  network_setup: 'Network Setup',
  account: 'Billing & Account',
};

async function authFetch(path: string): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

export default function HelpCenterPage() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') as HelpCategory | null;

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [articles, setArticles] = useState<HelpArticleListItem[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(
    categoryParam && (HELP_CATEGORIES as readonly { category: string }[]).some(c => c.category === categoryParam)
      ? categoryParam
      : null
  );

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HelpSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [roleArticles, setRoleArticles] = useState<HelpArticleListItem[]>([]);
  const [roleLoading, setRoleLoading] = useState(true);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await authFetch('/api/help/articles');
      if (!res.ok) { setFetchError(true); return; }
      const data = await res.json();
      setArticles(data.articles ?? []);
      setCategoryGroups(data.categoryGroups ?? []);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  // Role-specific articles
  useEffect(() => {
    async function fetchRoleArticles() {
      setRoleLoading(true);
      try {
        const roleRes = await authFetch('/api/rbac/my-permissions');
        const roleData = roleRes.ok ? await roleRes.json() : null;
        const role = roleData?.workspaceRole ?? 'member';
        const res = await authFetch(`/api/help/articles?role=${role}&limit=5`);
        const data = res.ok ? await res.json() : null;
        setRoleArticles(data?.articles ?? []);
      } finally {
        setRoleLoading(false);
      }
    }
    fetchRoleArticles();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 1) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/help/search?q=${encodeURIComponent(query)}`);
        const data = res.ok ? await res.json() : null;
        setSearchResults(data?.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const popularArticles = [...articles].sort((a, b) => b.viewCount - a.viewCount);

  const displayedArticles = selectedCategory
    ? articles.filter(a => a.category === selectedCategory)
    : articles;

  const countFor = (cat: HelpCategory) =>
    categoryGroups.find(g => g.category === cat)?.count ?? 0;

  const SEARCH_CATEGORY_LABELS: Record<HelpCategory, string> = {
    faq: 'FAQ', api_guide: 'API Guide', troubleshooting: 'Troubleshooting',
    video_tutorial: 'Video', network_setup: 'Network Setup', account: 'Account',
  };

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 pb-2 pt-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search help articles…"
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {query && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {searching ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">Searching…</div>
          ) : searchResults.length === 0 ? (
            <div className="px-4 py-8 text-center space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">No articles found. Try a different search or browse categories.</p>
              <button onClick={() => setQuery('')} className="text-xs text-blue-600 underline">Clear Search</button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {searchResults.map(r => (
                <li key={r.id}>
                  <a
                    href={`/help/${r.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{r.summary}</p>
                      {r.matchedIn?.length > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Matched in: {r.matchedIn.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {SEARCH_CATEGORY_LABELS[r.category]}
                      </span>
                      <span className="text-xs text-gray-400">{r.readTimeMinutes} min</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Main content (hidden when searching) */}
      {!query && (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0 space-y-6">
            {/* Category grid — desktop 3-col, mobile horizontal scroll pills */}
            {loading ? (
              <ArticleShimmer variant="category-grid" />
            ) : (
              <>
                {/* Desktop grid */}
                <div className="hidden sm:grid grid-cols-3 gap-3">
                  {HELP_CATEGORIES.map(cat => (
                    <CategoryCard
                      key={cat.category}
                      category={cat.category}
                      label={CATEGORY_LABELS[cat.category]}
                      count={countFor(cat.category)}
                      selected={selectedCategory === cat.category}
                      onSelect={c => setSelectedCategory(prev => prev === c ? null : c)}
                    />
                  ))}
                </div>

                {/* Mobile horizontal scroll */}
                <div className="sm:hidden flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {HELP_CATEGORIES.map(cat => (
                    <button
                      key={cat.category}
                      onClick={() => setSelectedCategory(prev => prev === cat.category ? null : cat.category)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedCategory === cat.category
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {CATEGORY_LABELS[cat.category]}
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] px-1 rounded-full">
                        {countFor(cat.category)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Article list */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              {selectedCategory && (
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {CATEGORY_LABELS[selectedCategory]}
                  </span>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Browse All
                  </button>
                </div>
              )}

              {loading ? (
                <ArticleShimmer variant="list" />
              ) : fetchError ? (
                <div className="p-4 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-700 dark:text-red-400 flex-1">Failed to load articles.</span>
                  <button onClick={fetchArticles} className="text-xs text-red-700 underline">Retry</button>
                </div>
              ) : displayedArticles.length === 0 ? (
                <div className="px-4 py-8 text-center space-y-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No articles found for this category.
                  </p>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs text-blue-600 underline"
                  >
                    Browse All
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {displayedArticles.map(article => (
                    <ArticleRow key={article.id} article={article} />
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar content on mobile */}
            <div className="lg:hidden space-y-4">
              <PopularArticlesSidebar articles={popularArticles} loading={loading} />
              <RoleGuidesPanel articles={roleArticles} loading={roleLoading} />
            </div>
          </div>

          {/* Desktop sidebar */}
          <div className="hidden lg:flex flex-col gap-4 w-64 flex-shrink-0">
            <PopularArticlesSidebar articles={popularArticles} loading={loading} />
            <RoleGuidesPanel articles={roleArticles} loading={roleLoading} />
          </div>
        </div>
      )}

      {/* Contact Support CTA */}
      {!query && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 text-center bg-gray-50 dark:bg-gray-800/50">
          <Mail className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Didn&apos;t find what you&apos;re looking for?</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Our support team is here to help.</p>
          <a
            href="mailto:support@adprofittracker.com"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Contact Support
          </a>
        </div>
      )}
    </div>
  );
}

function RoleGuidesPanel({ articles, loading }: { articles: HelpArticleListItem[]; loading: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Role-Specific Guides</h3>
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className="text-xs text-gray-400">No guides available for your role.</p>
      ) : (
        <ul className="space-y-2">
          {articles.map(article => (
            <li key={article.id}>
              <a
                href={`/help/${article.id}`}
                className="text-xs text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {article.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
