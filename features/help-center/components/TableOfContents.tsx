'use client';

import { useMemo, useState, useEffect } from 'react';

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

function parseHeadings(markdown: string): Heading[] {
  const lines = markdown.split('\n');
  return lines
    .filter(l => l.match(/^#{2,3}\s/))
    .map(l => {
      const level = l.startsWith('### ') ? 3 : 2;
      const text = l.replace(/^#+\s/, '').trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return { id, text, level };
    });
}

interface TableOfContentsProps {
  markdown: string;
}

export default function TableOfContents({ markdown }: TableOfContentsProps) {
  const headings = useMemo(() => parseHeadings(markdown), [markdown]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (headings.length < 2) return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );
    headings.forEach(h => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  const handleSelect = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:block sticky top-20" aria-label="Table of contents">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">On this page</p>
        <ul className="space-y-1">
          {headings.map(h => (
            <li key={h.id} style={{ paddingLeft: h.level === 3 ? '12px' : '0' }}>
              <button
                onClick={() => handleSelect(h.id)}
                className={`text-left text-xs transition-colors w-full ${
                  activeId === h.id
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile dropdown */}
      <div className="lg:hidden mb-4">
        <label className="text-xs text-gray-500 mr-2">Jump to section:</label>
        <select
          onChange={e => handleSelect(e.target.value)}
          className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
          defaultValue=""
        >
          <option value="" disabled>Select section</option>
          {headings.map(h => (
            <option key={h.id} value={h.id}>{h.level === 3 ? '  ↳ ' : ''}{h.text}</option>
          ))}
        </select>
      </div>
    </>
  );
}
