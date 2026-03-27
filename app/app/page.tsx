"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getAuth } from "firebase/auth";
import LoginModal from "@/components/auth/LoginModal";

function RootPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading || !user) return;
    const returnUrl = searchParams.get("returnUrl");
    // Check if the user has completed onboarding
    const checkOnboarding = async () => {
      try {
        const token = await getAuth().currentUser?.getIdToken();
        const res = await fetch("/api/auth/get-user", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          const completed = !!data?.user?.onboardingCompletedAt;
          if (completed) {
            // Mark as done in cookie so middleware lets through
            document.cookie = "ob_done=1; path=/; max-age=31536000; SameSite=Lax";
            router.replace(returnUrl ?? "/dashboard");
          } else {
            router.replace("/onboarding");
          }
          return;
        }
      } catch {
        // On error, fall through to default redirect
      }
      router.replace(returnUrl ?? "/dashboard");
    };
    checkOnboarding();
  }, [user, loading, router, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // User is authenticated — redirect fires via useEffect, render nothing meanwhile
  if (user) return null;

  // Unauthenticated — show the login modal on this route
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <LoginModal isOpen={true} />
    </div>
  );
}

/**
 * Root route (/).
 * - Loading: show a full-page spinner (no flash of modal or protected content).
 * - Authenticated: redirect to returnUrl if present, otherwise /dashboard.
 * - Unauthenticated: show the LoginModal directly on this route.
 */
export default function RootPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    }>
      <RootPageInner />
    </Suspense>
  );
}
