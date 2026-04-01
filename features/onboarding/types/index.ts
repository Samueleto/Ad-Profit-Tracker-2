// Step 117: TypeScript types for onboarding user fields

import type { Timestamp } from 'firebase/firestore';

export type DefaultDateRange = 'last7days' | 'last30days' | 'thisMonth';

export interface UserPreferences {
  timezone?: string;
  defaultDateRange?: DefaultDateRange;
}

export interface OnboardingFormValues {
  displayName: string;
  timezone: string;
  defaultDateRange: DefaultDateRange;
}

export interface UpdateProfilePayload {
  displayName?: string;
  onboardingCompletedAt?: 'serverTimestamp';
  onboardingSkipped?: boolean;
  preferences?: UserPreferences;
}

// Onboarding fields to augment the User type
export interface OnboardingUserFields {
  onboardingCompletedAt: Timestamp | null;
  onboardingSkipped?: boolean;
  preferences?: UserPreferences;
}
