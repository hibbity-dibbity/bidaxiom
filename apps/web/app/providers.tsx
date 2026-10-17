"use client";

import { browserApiUrl } from "@/lib/api-url";
import { useState, useMemo } from "react";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/react-query";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { AbilityContext, defineAbilitiesFor } from "@/lib/abilities";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { SessionData } from "@/lib/session";

function TrpcAndAbilityProvider({ children }: { children: React.ReactNode }) {
  const { orgRole, userId } = useAuth();

  // Build CASL abilities from org role
  const abilities = useMemo(() => {
    const role = orgRole ?? "org:member";
    return defineAbilitiesFor(role, userId ?? "");
  }, [orgRole, userId]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            toast.error("Failed to load data", {
              id: "query-error",
              description: error instanceof Error ? error.message : "An unexpected error occurred",
            });
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${browserApiUrl()}/trpc`,
          async headers() {
            // Fetch access token from session via API route
            try {
              const res = await fetch("/api/auth/token");
              if (res.ok) {
                const { accessToken } = await res.json();
                return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
              }
            } catch {}
            return {};
          },
          async fetch(url, options) {
            let response = await globalThis.fetch(url, options);
            if (response.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/sign-in") {
              // The access token may simply have run out. Renew it quietly and try once more before signing anyone out.
              try {
                const renewed = await fetch("/api/auth/refresh-session", { method: "POST" });
                if (renewed.ok) {
                  const { accessToken } = await (await fetch("/api/auth/token")).json();
                  if (accessToken) {
                    const headers = new Headers((options as RequestInit | undefined)?.headers);
                    headers.set("Authorization", `Bearer ${accessToken}`);
                    response = await globalThis.fetch(url, { ...(options as RequestInit), headers });
                  }
                }
              } catch {}
            }
            if (
              response.status === 401 &&
              typeof window !== "undefined" &&
              window.location.pathname !== "/sign-in"
            ) {
              const returnUrl = encodeURIComponent(
                window.location.pathname + window.location.search
              );
              window.location.href = `/sign-in?redirect_url=${returnUrl}`;
            }
            return response;
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AbilityContext.Provider value={abilities}>
          {children}
          <Toaster />
        </AbilityContext.Provider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export function Providers({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: SessionData;
}) {
  return (
    <ThemeProvider>
      <NuqsAdapter>
        <AuthProvider initialSession={initialSession}>
          <TrpcAndAbilityProvider>{children}</TrpcAndAbilityProvider>
        </AuthProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
