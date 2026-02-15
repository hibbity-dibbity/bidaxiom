"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  /**
   * Display variant:
   * - sidebar: Sidebar header (icon + text or icon-only when collapsed)
   * - topbar: Top navigation bar (compact)
   * - auth: Sign-in page (large, centered)
   */
  variant: "sidebar" | "topbar" | "auth";
  /**
   * Optional className for custom styling
   */
  className?: string;
  /**
   * Show company name alongside logo (if space permits)
   */
  showName?: boolean;
}

export function CompanyLogo({
  variant,
  className,
  showName = true,
}: CompanyLogoProps) {
  const { data, isLoading } = trpc.company.getLogo.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const [imageError, setImageError] = useState(false);
  const logoUrl = data?.logoUrl;
  const hasLogo = logoUrl && !imageError;

  // Reset error state when logo URL changes
  useEffect(() => {
    setImageError(false);
  }, [logoUrl]);

  // Variant-specific sizing
  const sizes = {
    sidebar: { icon: 32, container: "h-8 w-8" },
    topbar: { icon: 28, container: "h-7 w-7" },
    auth: { icon: 64, container: "h-16 w-16" },
  };

  const size = sizes[variant];

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        variant === "auth" && "flex-col",
        className
      )}
    >
      {/* Logo image or fallback icon */}
      <div
        className={cn(
          "flex items-center justify-center rounded-md overflow-hidden",
          size.container,
          !hasLogo && "bg-construction text-construction-foreground"
        )}
      >
        {hasLogo ? (
          <Image
            src={logoUrl}
            alt="Company logo"
            width={size.icon}
            height={size.icon}
            className="object-contain"
            onError={() => setImageError(true)}
            unoptimized // S3 pre-signed URLs don't work with Next.js image optimization
          />
        ) : (
          <Building2 className="h-5 w-5" />
        )}
      </div>

      {/* Company name (conditionally shown based on variant and prop) */}
      {showName && (
        <span
          className={cn(
            "font-semibold",
            variant === "sidebar" && "text-sm group-data-[collapsible=icon]:hidden",
            variant === "topbar" && "text-sm",
            variant === "auth" && "text-xl"
          )}
        >
          ConstructionSaaS
        </span>
      )}
    </div>
  );
}
