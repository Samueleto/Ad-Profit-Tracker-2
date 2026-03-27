"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/auth/LoginModal";

function RootPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && user) {
      const returnUrl = searchParams.get("returnUrl");
      router.replace(returnUrl ?? "/dashboard");
    }
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
