import { AppShell } from "@/components/layout/app-shell";

/**
 * Dashboard route group layout.
 * Wraps all authenticated pages in the AppShell (sidebar + topbar + content).
 * Applies to /, /projects, /bids, /financials, /settings, etc.
 * Does NOT wrap auth pages (/sign-in, /sign-up, /mfa-setup).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
