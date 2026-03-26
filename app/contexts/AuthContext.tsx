"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/auth";

// ─── User profile type (from Firestore `users` collection) ────────────────────

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: string;
  preferences?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface AuthContextType {
  user: AppUser | null;
  firebaseUser: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  updateUser: (data: Partial<AppUser>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  error: null,
  signOut: async () => {},
  updateUser: async () => {},
  deleteAccount: async () => {},
  getIdToken: async () => null,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Guard against state updates after unmount or after a subsequent auth change
  const currentUidRef = useRef<string | null>(null);

  const fetchUserProfile = async (fbUser: User): Promise<AppUser | null> => {
    const token = await fbUser.getIdToken();
    const headers = { Authorization: `Bearer ${token}` };

    let res = await fetch("/api/auth/get-user", { headers });

    if (res.status === 404) {
      // User doc doesn't exist yet — create it via sync
      const syncRes = await fetch("/api/auth/sync-user", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      });
      if (!syncRes.ok) return null;
      // Fetch again after sync
      res = await fetch("/api/auth/get-user", { headers });
    }

    if (!res.ok) return null;
    const data = await res.json();
    return data?.user ?? data ?? null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      currentUidRef.current = fbUser?.uid ?? null;
      setFirebaseUser(fbUser);
      setError(null);

      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await fetchUserProfile(fbUser);
        // Guard: if auth state changed again while fetching, discard stale result
        if (currentUidRef.current !== fbUser.uid) return;
        setUser(profile);
      } catch (err) {
        if (currentUidRef.current !== fbUser.uid) return;
        setError(err instanceof Error ? err.message : "Failed to load user profile");
        setUser(null);
      } finally {
        if (currentUidRef.current === fbUser.uid || currentUidRef.current === null) {
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribe();
      currentUidRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getIdToken = async (): Promise<string | null> => {
    if (!firebaseUser) return null;
    return firebaseUser.getIdToken();
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUser(null);
    router.push("/");
  };

  const updateUser = async (data: Partial<AppUser>) => {
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch("/api/auth/update-profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update profile");
    const updated = await res.json();
    setUser(prev => prev ? { ...prev, ...(updated?.user ?? updated ?? data) } : prev);
  };

  const deleteAccount = async () => {
    const token = await getIdToken();
    if (!token) return;
    await fetch("/api/auth/delete-account", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setUser(null);
    setFirebaseUser(null);
    router.push("/");
  };

  return (
    <AuthContext.Provider
      value={{ user, firebaseUser, loading, error, signOut, updateUser, deleteAccount, getIdToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
