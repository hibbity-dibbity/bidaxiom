"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { SETTINGS_GROUPS, canOpen, itemForPath } from "./settings-nav";

/**
 * Every settings page sits in this frame: a grouped menu on the left (only what the signed-in person may open) and
 * the page on the right. The Settings home page shows the same groups as cards, so it has no menu of its own.
 * A page the person's role cannot open says so instead of loading.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { orgRole } = useAuth();
  const isHome = pathname === "/settings";
  const current = itemForPath(pathname);

  if (isHome) return <>{children}</>;

  if (current && !canOpen(current, orgRole)) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{current.label}</h1>
        <p className="text-sm text-muted-foreground">Your role cannot view this page. Ask a company administrator.</p>
        <Link href="/settings" className="text-sm text-primary hover:underline">← All settings</Link>
      </div>
    );
  }

  const groups = SETTINGS_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canOpen(i, orgRole)) })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-wrap items-start gap-8">
      <nav aria-label="Settings" className="flex w-full flex-col lg:w-56 lg:shrink-0">
        <Link href="/settings" className="mb-2 px-3 text-sm text-primary hover:underline">← All settings</Link>
        {groups.map((g) => (
          <div key={g.id} className="mt-3">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.label}{g.adminOnly ? " · admin" : ""}
            </div>
            {g.items.map((i) => {
              const on = current?.href === i.href;
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={on ? "page" : undefined}
                  className={cn("block rounded-md px-3 py-1.5 text-sm hover:bg-muted", on && "bg-primary/10 font-semibold text-primary hover:bg-primary/10")}
                >
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-[999_1_560px]">{children}</div>
    </div>
  );
}
