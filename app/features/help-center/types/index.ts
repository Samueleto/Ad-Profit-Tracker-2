// Step 149: TypeScript types for help center

import type { Timestamp } from 'firebase-admin/firestore';

export type HelpCategory = 'faq' | 'api_guide' | 'troubleshooting' | 'video_tutorial' | 'network_setup' | 'account';

export interface HELP_CATEGORY_CONFIG {
  category: HelpCategory;
  label: string;
  iconName: string;
}

export const HELP_CATEGORIES: HELP_CATEGORY_CONFIG[] = [
  { category: 'faq', label: 'FAQ', iconName: 'HelpCircle' },
  { category: 'api_guide', label: 'API Guide', iconName: 'Code' },
  { category: 'troubleshooting', label: 'Troubleshooting', iconName: 'AlertTriangle' },
  { category: 'video_tutorial', label: 'Video Tutorials', iconName: 'Play' },
  { category: 'network_setup', label: 'Network Setup', iconName: 'Settings' },
  { category: 'account', label: 'Account', iconName: 'User' },
];

export interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  category: HelpCategory;
  body: string;
  summary: string;
  tags: string[];
  requiredPermission: string | null;
  requiredRole: string | null;
  readTimeMinutes: number;
  videoUrl: string | null;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  isPublished: boolean;
  authorName: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface HelpArticleListItem extends Omit<HelpArticle, 'body'> {
  isNew: boolean;
}

export interface CategoryGroup {
  category: HelpCategory;
  count: number;
}

export interface HelpSearchResult {
  id: string;
  title: string;
  slug: string;
  category: HelpCategory;
  summary: string;
  readTimeMinutes: number;
  matchedIn: string[];
  score: number;
  updatedAt: Timestamp | string;
}

export interface HelpFeedbackPayload {
  articleId: string;
  rating: 'helpful' | 'not_helpful';
  comment?: string;
}
