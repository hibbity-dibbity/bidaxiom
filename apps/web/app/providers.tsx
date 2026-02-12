"use client";

import { useState, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/react-query";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { AbilityContext, defineAbilitiesFor } from "@/lib/abilities";

/**
 * App-wide providers: tRPC + React Query + auth token forwarding.
 *
 * Wraps the app with:
 * 1. tRPC provider (type-safe API calls)
 * 2. React Query provider (caching, background refetching)
 * 3. Clerk auth token forwarding (Bearer token in tRPC requests)
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const { getToken, userId } = useAuth();
  const { membership } = useOrganization();

  // Build CASL abilities from Clerk org role
  const abilities = useMemo(() => {
    const role = membership?.role ?? "org:member";
    return defineAbilitiesFor(role, userId ?? "");
  }, [membership?.role, userId]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
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
            // Forward Clerk auth token to Fastify tRPC backend
            const token = await getToken();
            return token
              ? { Authorization: `Bearer ${token}` }
              : {};
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
