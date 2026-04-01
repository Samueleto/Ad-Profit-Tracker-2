'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import type { HelpArticle, HelpCategory } from '../types';
import type { WorkspaceRole } from '@/features/rbac/types';

// ─── Shared token helper ──────────────────────────────────────────────────────

export async function getFreshToken(refresh = false): Promise<string | undefined> {
  return getAuth().currentUser?.getIdToken(refresh);
}

export function buildAuthHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// Fetch with automatic 401 retry (force-refresh token) then redirect on second 401
export async function helpAuthFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const makeReq = async (refresh: boolean) => {
    const token = await getFreshToken(refresh);
    return fetch(url, {
      ...init,
      headers: {
        ...buildAuthHeaders(token),
        ...(init.headers as Record<string, string> ?? {}),
      },
    });
  };
  let res = await makeReq(false);
  if (res.status === 401) {
    res = await makeReq(true);
    if (res.status === 401) {
      window.location.replace('/');
    }
  }
  return res;
}

// ─── useHelpCenter ────────────────────────────────────────────────────────────

export interface UseHelpCenterResult {
  articles: HelpArticle[];
  categoryCount: Record<HelpCategory, number>;
  popularArticles: HelpArticle[];
  roleArticles: HelpArticle[];
  searchResults: HelpArticle[] | null;
  selectedCategory: HelpCategory | null;
  searchQuery: string;
  isLoading: boolean;
  isSearching: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  errorStatus: number | null;
  setSelectedCategory: (category: HelpCategory | null) => void;
  setSearchQuery: (query: string) => void;
  loadMore: () => Promise<void>;
}

export function useHelpCenter(): UseHelpCenterResult {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [categoryCount, setCategoryCount] = useState<Record<HelpCategory, number>>({} as Record<HelpCategory, number>);
  const [roleArticles, setRoleArticles] = useState<HelpArticle[]>([]);
  const [searchResults, setSearchResults] = useState<HelpArticle[] | null>(null);
  const [selectedCategory, setSelectedCategoryState] = useState<HelpCategory | null>(null);
  const [searchQuery, setSearchQueryState] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const fetchIdRef = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Store the base article list so clearing search restores it (no re-fetch)
  const baseArticlesRef = useRef<HelpArticle[]>([]);

  // ─── Fetch articles (category-filtered) ──────────────────────────────────

  const fetchArticles = useCallback(async (category: HelpCategory | null, cursor?: string) => {
    const fetchId = ++fetchIdRef.current;
    if (!cursor) setIsLoading(true);
    setErrorStatus(null);

    try {
      const params = new URLSearchParams({ limit: '20' });
      if (category) params.set('category', category);
      if (cursor) params.set('cursor', cursor);

      const res = await helpAuthFetch(`/api/help/articles?${params}`);
      if (!res.ok) {
        if (fetchId === fetchIdRef.current) setErrorStatus(res.status);
        return;
      }
      const data = await res.json();
      if (fetchId !== fetchIdRef.current) return;

      const fetched: HelpArticle[] = data.articles ?? [];
      if (cursor) {
        setArticles((prev) => {
          const next = [...prev, ...fetched];
          baseArticlesRef.current = next;
          return next;
        });
      } else {
        setArticles(fetched);
        baseArticlesRef.current = fetched;
        if (data.categoryCounts) setCategoryCount(data.categoryCounts);
      }
      setHasMore(data.hasMore ?? false);
      setNextCursor(data.nextCursor ?? null);
    } finally {
      if (fetchIdRef.current === fetchId) setIsLoading(false);
    }
  }, []);

  // ─── Initial load + role articles ────────────────────────────────────────

  useEffect(() => {
    fetchArticles(null);

    // Fetch role-specific articles after getting the workspace role
    (async () => {
      try {
        const roleRes = await helpAuthFetch('/api/rbac/my-permissions');
        if (!roleRes.ok) return;
        const roleData = await roleRes.json();
        const role: WorkspaceRole = roleData.workspaceRole;
        if (!role) return;
        const artRes = await helpAuthFetch(`/api/help/articles?role=${encodeURIComponent(role)}&limit=6`);
        if (!artRes.ok) return;
        const artData = await artRes.json();
        setRoleArticles(artData.articles ?? []);
      } catch { /* non-critical */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Category selection ───────────────────────────────────────────────────

  const setSelectedCategory = useCallback((category: HelpCategory | null) => {
    setSelectedCategoryState(category);
    setSearchQueryState('');
    setSearchResults(null);
    fetchArticles(category);
  }, [fetchArticles]);

  // ─── Search (debounced 300ms) ─────────────────────────────────────────────

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!query.trim()) {
      setSearchResults(null);
      setArticles(baseArticlesRef.current);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({ q: query });
        if (selectedCategory) params.set('category', selectedCategory);
        const res = await helpAuthFetch(`/api/help/search?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setSearchResults(data.articles ?? []);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [selectedCategory]);

  // ─── Load more (pagination) ───────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await fetchArticles(selectedCategory, nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, nextCursor, isLoadingMore, selectedCategory, fetchArticles]);

  // ─── Derived popular articles ─────────────────────────────────────────────

  const popularArticles = useMemo(
    () => [...articles].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5),
    [articles]
  );

  return {
    articles: searchResults ?? articles,
    categoryCount,
    popularArticles,
    roleArticles,
    searchResults,
    selectedCategory,
    searchQuery,
    isLoading,
    isSearching,
    isLoadingMore,
    hasMore,
    errorStatus,
    setSelectedCategory,
    setSearchQuery,
    loadMore,
  };
}
