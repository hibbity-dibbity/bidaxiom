/**
 * Server-side tRPC client for making backend calls from Next.js API routes.
 * Uses httpBatchLink to call the backend API.
 */

import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../api/src/trpc/router";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function createServerTRPCClient(token?: string) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      }),
    ],
  });
}
