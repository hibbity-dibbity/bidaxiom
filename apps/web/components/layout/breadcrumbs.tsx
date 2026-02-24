"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * Segment labels for known routes.
 * Future phases will add project-level and section-level breadcrumbs.
 */
const segmentLabels: Record<string, string> = {
  projects: "Projects",
  bids: "Bidding",
  financials: "Financials",
  documents: "Documents",
  settings: "Settings",
  estimates: "Proposals",
  expenses: "Expenses",
};

/**
 * Breadcrumbs showing: Company > Section > Subsection
 * Per locked decision: "Breadcrumbs show: Company -> Project -> [Current Section]"
 *
 * For Phase 1: Shows Company > Dashboard (simple).
 * Future phases add project-level breadcrumbs as routes are built.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const { orgName } = useAuth();

  const segments = pathname.split("/").filter(Boolean);
  const companyName = orgName ?? "Company";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">{companyName}</BreadcrumbLink>
        </BreadcrumbItem>

        {segments.length === 0 ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          segments.map((segment, idx) => {
            const label = segmentLabels[segment] ?? segment;
            const isLast = idx === segments.length - 1;
            const href = "/" + segments.slice(0, idx + 1).join("/");

            return (
              <span key={segment} className="flex items-center gap-1.5">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            );
          })
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
