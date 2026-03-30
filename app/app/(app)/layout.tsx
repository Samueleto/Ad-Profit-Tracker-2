// Auth for this layout is enforced by middleware.ts (app/middleware.ts).
// Unauthenticated requests are redirected to / before this layout renders.
// Do NOT remove the middleware — this layout does not enforce auth on its own.
import AppShell from "@/components/layout/AppShell";
import AuthGuard from "@/components/auth/AuthGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
