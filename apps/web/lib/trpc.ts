"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { CreateTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@construction/api/src/trpc/router";

/**
 * tRPC React client with end-to-end type safety.
 * All procedure calls are fully typed based on the AppRouter.
 */
export const trpc: CreateTRPCReact<AppRouter, unknown> =
  createTRPCReact<AppRouter>();
