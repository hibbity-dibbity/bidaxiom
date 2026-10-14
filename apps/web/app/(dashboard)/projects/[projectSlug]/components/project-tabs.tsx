"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { isFeatureAvailableInPhase, type LifecyclePhase } from "@construction/shared";

interface ProjectTabsProps {
  projectSlug: string;
  projectMode: string;
  lifecyclePhase: string;
  headerStats?: {
    changeOrdersPendingCount: number;
    documentsCount: number;
    invoicesCount: number;
  } | null;
  orderCounts?: { purchase: number; work: number } | null;
  openInvoices?: number;
}

const ALL_SECTIONS = [
  { name: "Overview",      href: "" },
  { name: "Documents",     href: "/documents" },
  { name: "Proposals",     href: "/estimates" },
  { name: "Purchase Orders", href: "/purchase-orders" },
  { name: "Work Orders",   href: "/work-orders" },
  { name: "Change Orders", href: "/change-orders" },
  { name: "Invoices",      href: "/invoices" },
] as const;

export function ProjectTabs({ projectSlug, projectMode, lifecyclePhase, headerStats, orderCounts, openInvoices }: ProjectTabsProps) {
  const pathname = usePathname();
  const utils = trpc.useUtils();

  // Get project ID from cached getBySlug query (still needed for prefetch handlers)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  // Filter out GC-only tabs in Simple mode; filter out phase-gated tabs based on lifecycle phase
  const sections = ALL_SECTIONS.filter((s) => {
    // Mode gate: hide GC-only tabs in Simple mode
    if ("gcOnly" in s && s.gcOnly && projectMode !== "gc_advanced") return false;
    // Phase gate: hide features not available in current lifecycle phase
    if ("phaseGated" in s && s.phaseGated) {
      return isFeatureAvailableInPhase(s.phaseGated as string, lifecyclePhase as LifecyclePhase);
    }
    return true;
  });

  // Prefetch handlers for each section
  const prefetchOverview = () => {
    if (!projectId) return;
    utils.proposal.listChangeOrders.prefetch({ projectId });
    utils.rfq.list.prefetch({ projectId });
  };

  const prefetchDocuments = () => {
    if (!projectId) return;
    utils.document.listUnified.prefetch({ projectId });
  };

  const prefetchChangeOrders = () => {
    if (!projectId) return;
    utils.proposal.listChangeOrders.prefetch({ projectId });
  };

  const prefetchInvoices = () => {
    if (!projectId) return;
    utils.invoice.list.prefetch({ projectId });
  };

  const prefetchRFQs = () => {
    if (!projectId) return;
    utils.rfq.list.prefetch({ projectId });
  };

  const prefetchEstimates = () => {
    if (!projectId) return;
    utils.estimates.list.prefetch({ projectId });
  };

  // Map sections to their prefetch handlers
  const sectionPrefetchMap: Record<string, () => void> = {
    "": prefetchOverview,
    "/documents": prefetchDocuments,
    "/change-orders": prefetchChangeOrders,
    "/invoices": prefetchInvoices,
    "/rfqs": prefetchRFQs,
    "/estimates": prefetchEstimates,
    "/purchase-orders": () => {},
    "/work-orders": () => {},
  };

  const getBadgeCount = (href: string): number => {
    if (href === "/purchase-orders") return orderCounts?.purchase ?? 0;
    if (href === "/work-orders") return orderCounts?.work ?? 0;
    if (href === "/invoices") return openInvoices ?? 0;
    if (!headerStats) return 0;
    switch (href) {
      case "/change-orders": return headerStats.changeOrdersPendingCount;
      case "/documents": return headerStats.documentsCount;
      case "/invoices": return headerStats.invoicesCount;
      default: return 0;
    }
  };

  return (
    <nav className="border-b">
      <div className="flex gap-6 overflow-x-auto">
        {sections.map((section) => {
          const fullHref = `/projects/${projectSlug}${section.href}`;

          // For Overview, check exact match. For others, check if pathname starts with the href
          const isActive =
            section.href === ""
              ? pathname === fullHref
              : pathname.startsWith(fullHref);

          const prefetchHandler = sectionPrefetchMap[section.href];
          const badge = getBadgeCount(section.href);
          const label = badge > 0 ? `${section.name} (${badge})` : section.name;

          return (
            <Link
              key={section.name}
              href={fullHref}
              scroll={false}
              onMouseEnter={prefetchHandler}
              className={cn(
                "py-3 text-sm border-b-2 whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
