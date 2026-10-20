import { AppShell } from "@/components/layout/app-shell";
import { SessionWatcher } from "@/components/session-watcher";
import { MobileTables } from "@/components/layout/mobile-tables";

/**
 * Dashboard route group layout.
 * Wraps all authenticated pages in the AppShell (sidebar + topbar + content).
 * Applies to /, /projects, /bids, /financials, /settings, etc.
 * Does NOT wrap auth pages (/sign-in, /sign-up, /mfa-setup).
 *
 * SessionWatcher is a client component mounted here that checks JWT expiry
 * on tab visibility-change and every 5 minutes, redirecting to sign-in when expired.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SessionWatcher />
      <MobileTables />
      <AppShell>{children}</AppShell>
    </>
  );
}
