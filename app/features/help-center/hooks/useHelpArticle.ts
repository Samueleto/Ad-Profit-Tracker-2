'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { buildAuthHeaders, getFreshToken } from './useHelpCenter';
import type { HelpArticle } from '../types';

// Re-export for convenience
export { buildAuthHeaders };

// ─── useHelpArticle ───────────────────────────────────────────────────────────

export interface UseHelpArticleResult {
  article: HelpArticle | null;
  relatedArticles: HelpArticle[];
  loading: boolean;
  relatedLoading: boolean;
  errorStatus: number | null;
  feedbackSubmitted: boolean;
  submitFeedback: (rating: 'helpful' | 'not_helpful') => Promise<void>;
}

export function useHelpArticle(articleId: string): UseHelpArticleResult {
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    setErrorStatus(null);
    setArticle(null);
    setRelatedArticles([]);
    setFeedbackSubmitted(false);

    (async () => {
      try {
        const token = await getFreshToken();
        const res = await fetch(`/api/help/articles/${articleId}`, {
          headers: buildAuthHeaders(token),
        });
        if (!res.ok) {
          if (mountedRef.current) setErrorStatus(res.status);
          return;
        }
        const data = await res.json();
        const fetched: HelpArticle = data.article ?? data;
        if (!mountedRef.current) return;
        setArticle(fetched);

        // Fire-and-forget view increment
        getFreshToken().then((t) =>
          fetch(`/api/help/articles/${articleId}/view`, {
            method: 'PATCH',
            headers: buildAuthHeaders(t),
          }).catch(() => {})
        );

        // Load related articles once category is known
        if (fetched.category) {
          setRelatedLoading(true);
          try {
            const token2 = await getFreshToken();
            const params = new URLSearchParams({ category: fetched.category, limit: '4' });
            const relRes = await fetch(`/api/help/articles?${params}`, {
              headers: buildAuthHeaders(token2),
            });
            if (relRes.ok && mountedRef.current) {
              const relData = await relRes.json();
              setRelatedArticles(
                (relData.articles ?? []).filter((a: HelpArticle) => a.id !== articleId)
              );
            }
          } finally {
            if (mountedRef.current) setRelatedLoading(false);
          }
        }
      } catch {
        if (mountedRef.current) setErrorStatus(500);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [articleId]);

  const submitFeedback = useCallback(async (rating: 'helpful' | 'not_helpful') => {
    if (feedbackSubmitted) return;
    setFeedbackSubmitted(true);
    try {
      const token = await getFreshToken();
      await fetch('/api/help/feedback', {
        method: 'POST',
        headers: { ...buildAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, rating }),
      });
    } catch { /* non-critical */ }
  }, [articleId, feedbackSubmitted]);

  return { article, relatedArticles, loading, relatedLoading, errorStatus, feedbackSubmitted, submitFeedback };
}

// ─── useTableOfContents ───────────────────────────────────────────────────────

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface UseTableOfContentsResult {
  headings: TocHeading[];
  activeId: string | null;
}

export function useTableOfContents(containerRef: React.RefObject<HTMLElement | null>): UseTableOfContentsResult {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Parse headings
    const elements = Array.from(container.querySelectorAll<HTMLElement>('h2, h3'));
    const parsed: TocHeading[] = elements.map((el) => ({
      id: el.id || el.textContent?.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || '',
      text: el.textContent ?? '',
      level: el.tagName === 'H2' ? 2 : 3,
    }));
    // Assign ids if missing
    elements.forEach((el, i) => {
      if (!el.id && parsed[i]) el.id = parsed[i].id;
    });
    setHeadings(parsed);

    if (parsed.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [containerRef]);

  return { headings, activeId };
}
