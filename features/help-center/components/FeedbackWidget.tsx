'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { Toast } from '@/components/ui/Toast';

interface FeedbackWidgetProps {
  articleId: string;
}

type FeedbackState = 'idle' | 'submitting' | 'submitted' | 'already_rated' | 'error';

export default function FeedbackWidget({ articleId }: FeedbackWidgetProps) {
  const [state, setState] = useState<FeedbackState>('idle');
  const [showToast, setShowToast] = useState(false);

  const submit = async (rating: 'helpful' | 'not_helpful') => {
    setState('submitting');
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/help/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ articleId, rating }),
      });
      if (res.status === 429) { setState('already_rated'); return; }
      if (!res.ok) { setState('error'); return; }
      setState('submitted');
      setShowToast(true);
    } catch {
      setState('error');
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
      {state === 'submitted' && (
        <p className="text-sm text-gray-600 dark:text-gray-400">Thanks for your feedback!</p>
      )}
      {state === 'already_rated' && (
        <p className="text-sm text-gray-500 dark:text-gray-400">You&apos;ve already rated this article.</p>
      )}
      {state === 'error' && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-red-500">Something went wrong.</p>
          <button onClick={() => setState('idle')} className="text-xs text-blue-600 underline">Try again</button>
        </div>
      )}
      {(state === 'idle' || state === 'submitting') && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Was this helpful?</p>
          <button
            onClick={() => submit('helpful')}
            disabled={state === 'submitting'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-400 hover:text-green-600 disabled:opacity-60 transition-colors"
          >
            {state === 'submitting' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
            Yes
          </button>
          <button
            onClick={() => submit('not_helpful')}
            disabled={state === 'submitting'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 hover:text-red-600 disabled:opacity-60 transition-colors"
          >
            {state === 'submitting' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
            No
          </button>
        </div>
      )}
      {showToast && (
        <Toast
          message="Thanks for your feedback!"
          variant="success"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}
