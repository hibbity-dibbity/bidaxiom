"use client";

import { useState, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/react-query";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { AbilityContext, defineAbilitiesFor } from "@/lib/abilities";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/components/providers/theme-provider";
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
          url: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/trpc`,
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
      <AuthProvider initialSession={initialSession}>
        <TrpcAndAbilityProvider>{children}</TrpcAndAbilityProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
