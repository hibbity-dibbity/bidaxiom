/**
 * Server-side tRPC client for making backend calls from Next.js API routes.
 * Uses httpBatchLink to call the backend API.
 */

import { createTRPCProxyClient, httpLink } from "@trpc/client";
import type { AppRouter } from "../../../api/src/trpc/router";

// Server-side code may need a different address than the browser (e.g. the Docker
// network name). Falls back to the public URL when API_INTERNAL_URL isn't set.
const API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function createServerTRPCClient(token?: string) {
  const headers = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : undefined;

  return createTRPCProxyClient<AppRouter>({
    links: [
      httpLink({
        url: `${API_URL}/trpc`,
        headers,
      }),
    ],
  });
}
