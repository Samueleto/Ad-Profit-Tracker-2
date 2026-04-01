// Step 149: HelpArticle TypeScript types

export type HelpCategory =
  | 'faq'
  | 'api_guide'
  | 'troubleshooting'
  | 'video_tutorial'
  | 'network_setup'
  | 'account';

export interface HelpCategoryConfig {
  value: HelpCategory;
  label: string;
  icon: string;
}

export const HELP_CATEGORIES: HelpCategoryConfig[] = [
  { value: 'faq', label: 'FAQ', icon: 'help-circle' },
  { value: 'api_guide', label: 'API Guide', icon: 'code' },
  { value: 'troubleshooting', label: 'Troubleshooting', icon: 'alert-triangle' },
  { value: 'video_tutorial', label: 'Video Tutorial', icon: 'play-circle' },
  { value: 'network_setup', label: 'Network Setup', icon: 'network' },
  { value: 'account', label: 'Account', icon: 'user' },
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
  createdAt: FirebaseFirestore.Timestamp | string;
  updatedAt: FirebaseFirestore.Timestamp | string;
}

export interface HelpArticleListItem extends Omit<HelpArticle, 'body'> {
  isNew: boolean; // true if updatedAt is within the last 7 days
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
  updatedAt: string;
}

export interface HelpFeedbackPayload {
  articleId: string;
  rating: 'helpful' | 'not_helpful';
  comment?: string;
}
