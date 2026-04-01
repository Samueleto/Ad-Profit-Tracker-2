'use client';

import { useState, useEffect } from 'react';

/**
 * Returns whether the given CSS media query currently matches.
 * Returns false on the server (SSR) to avoid hydration mismatches.
 * Reactively updates when the window is resized.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    // Set initial value after mount
    setMatches(mediaQueryList.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQueryList.addEventListener('change', handler);
    return () => {
      mediaQueryList.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

/**
 * Convenience hook: returns true when viewport width < 768px (mobile).
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
