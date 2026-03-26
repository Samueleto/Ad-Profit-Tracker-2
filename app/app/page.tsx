"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/auth/LoginModal";

/**
 * Root route (/).
 * - Loading: show a full-page spinner (no flash of modal or protected content).
 * - Authenticated: redirect to /dashboard.
 * - Unauthenticated: show the LoginModal directly on this route.
 */
export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

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
