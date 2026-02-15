"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProjectTabsProps {
  projectSlug: string;
}

const sections = [
  { name: "Overview", href: "" },
  { name: "Documents", href: "/documents" },
  { name: "Budget", href: "/budget" },
  { name: "Commitments", href: "/commitments" },
  { name: "Change Orders", href: "/change-orders" },
  { name: "SOV", href: "/sov" },
  { name: "Payment Apps", href: "/payment-apps" },
  { name: "Invoices", href: "/invoices" },
  { name: "RFQs", href: "/rfqs" },
];

export function ProjectTabs({ projectSlug }: ProjectTabsProps) {
  const pathname = usePathname();

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

          return (
            <Link
              key={section.name}
              href={fullHref}
              scroll={false}
              className={cn(
                "py-3 text-sm border-b-2 whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {section.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
