'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Check, AlertCircle, Clock, User } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAuth } from 'firebase/auth';
import TableOfContents from '@/features/help-center/components/TableOfContents';
import FeedbackWidget from '@/features/help-center/components/FeedbackWidget';
import ArticleShimmer from '@/features/help-center/components/ArticleShimmer';
import ArticleRow from '@/features/help-center/components/ArticleRow';
import { toast } from 'sonner';
import type { HelpArticle, HelpArticleListItem, HelpCategory } from '@/features/help-center/types';

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

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const makeReq = async (refresh: boolean) => {
    const token = await auth.currentUser?.getIdToken(refresh);
    return fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

function formatDate(val: string | { seconds?: number } | unknown): string {
  try {
    if (typeof val === 'string') return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    if (val && typeof val === 'object' && 'seconds' in val) return new Date((val as { seconds: number }).seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return '';
  } catch { return ''; }
}

interface HelpArticlePageProps {
  params: Promise<{ articleId: string }>;
}

type LoadState = 'loading' | 'success' | 'error_403' | 'error_404' | 'error_500';

export default function HelpArticlePage({ params }: HelpArticlePageProps) {
  const { articleId } = use(params);
  const router = useRouter();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<HelpArticleListItem[]>([]);
  const [copied, setCopied] = useState(false);

  const loadArticle = async () => {
    setLoadState('loading');
    try {
      const res = await authFetch(`/api/help/articles/${articleId}`);
      if (res.status === 401) {
        // Session expired — brief redirect to login
        router.push('/');
        return;
      }
      if (res.status === 403) { setLoadState('error_403'); return; }
      if (res.status === 404) { setLoadState('error_404'); return; }
      if (!res.ok) { setLoadState('error_500'); return; }
      const data = await res.json();
      setArticle(data.article ?? data);
      setLoadState('success');

      // Fire-and-forget view increment
      authFetch(`/api/help/articles/${articleId}/view`, { method: 'PATCH' }).catch(() => {});
    } catch {
      setLoadState('error_500');
    }
  };

  useEffect(() => { loadArticle(); }, [articleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch related articles once we know the category
  useEffect(() => {
    if (!article) return;
    authFetch(`/api/help/articles?category=${article.category}&limit=4`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const all: HelpArticleListItem[] = data?.articles ?? [];
        setRelatedArticles(all.filter(a => a.id !== articleId).slice(0, 4));
      })
      .catch(() => {});
  }, [article, articleId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  if (loadState === 'error_403') {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Access Denied — this article requires elevated permissions.</p>
        <Link href="/help" className="text-sm text-blue-600 underline">Back to Help Center</Link>
      </div>
    );
  }

  if (loadState === 'error_404') {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Article not found.</p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/help" className="text-sm text-blue-600 underline">Back to Help Center</Link>
          <Link href="/help" className="text-sm text-blue-600 underline">Browse all articles</Link>
        </div>
      </div>
    );
  }

  if (loadState === 'error_500') {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-sm text-red-700 dark:text-red-400 flex-1">Failed to load article.</span>
        <button onClick={loadArticle} className="text-xs text-red-700 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/help"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Help Center
        </Link>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      {/* Breadcrumb */}
      {loadState === 'success' && article && (
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/help" className="hover:text-blue-600 transition-colors">Help</Link>
          <span>/</span>
          <Link
            href={`/help?category=${article.category}`}
            className="hover:text-blue-600 transition-colors"
          >
            {CATEGORY_LABELS[article.category]}
          </Link>
          <span>/</span>
          <span className="text-gray-600 dark:text-gray-300 truncate">{article.title}</span>
        </nav>
      )}

      {/* Article content */}
      {loadState === 'loading' ? (
        <ArticleShimmer variant="article" />
      ) : article ? (
        <div className="flex gap-8 items-start">
          {/* Main article */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${CATEGORY_COLORS[article.category]}`}>
                  {CATEGORY_LABELS[article.category]}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {article.title}
              </h1>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                {article.authorName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {article.authorName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated {formatDate(article.updatedAt)}
                </span>
                <span>{article.readTimeMinutes} min read</span>
              </div>
            </div>

            {/* Mobile TOC */}
            {article.body && <TableOfContents markdown={article.body} />}

            {/* Video embed */}
            {article.videoUrl && (
              <div className="mb-6 aspect-video w-full rounded-xl overflow-hidden bg-black">
                {article.videoUrl.includes('youtube') || article.videoUrl.includes('vimeo') ? (
                  <iframe
                    src={article.videoUrl}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : (
                  <video src={article.videoUrl} controls className="w-full h-full" />
                )}
              </div>
            )}

            {/* Article body */}
            {article.body && (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-code:text-pink-600 dark:prose-code:text-pink-400 prose-pre:bg-gray-900 prose-pre:text-gray-100">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {article.body}
                </ReactMarkdown>
              </div>
            )}

            {/* Feedback */}
            <FeedbackWidget articleId={articleId} />

            {/* Related articles */}
            {relatedArticles.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Related Articles</h3>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
                  {relatedArticles.map(a => (
                    <ArticleRow key={a.id} article={a} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Desktop TOC sidebar */}
          {article.body && (
            <div className="hidden lg:block w-56 flex-shrink-0">
              <TableOfContents markdown={article.body} />
            </div>
          )}
        </div>
      ) : null}

    </div>
  );
}
