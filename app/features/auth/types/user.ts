// Step 116: User TypeScript types and Firestore helpers

import type { Timestamp, FirestoreDataConverter, DocumentData, QueryDocumentSnapshot, SnapshotOptions } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  authProvider: 'google' | 'email';
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  role: 'user' | 'admin';
  preferences: {
    defaultDateRange: string;
    timezone: string;
  };
}

export type UserProfileUpdate = Partial<Pick<UserProfile, 'displayName' | 'preferences'>>;

export interface UserProfileResponse {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  authProvider: 'google' | 'email';
  createdAt: string; // ISO string
  lastLoginAt: string; // ISO string
  role: 'user' | 'admin';
  preferences: {
    defaultDateRange: string;
    timezone: string;
  };
}

// Firestore data converter for UserProfile
export const userProfileConverter: FirestoreDataConverter<UserProfile> = {
  toFirestore(user: UserProfile): DocumentData {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      role: user.role,
      preferences: user.preferences,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): UserProfile {
    const data = snapshot.data(options);
    return {
      uid: snapshot.id,
      email: data.email,
      displayName: data.displayName ?? null,
      photoURL: data.photoURL ?? null,
      authProvider: data.authProvider,
      createdAt: data.createdAt,
      lastLoginAt: data.lastLoginAt,
      role: data.role ?? 'user',
      preferences: data.preferences ?? { defaultDateRange: 'last_7_days', timezone: 'UTC' },
    };
  },
};
