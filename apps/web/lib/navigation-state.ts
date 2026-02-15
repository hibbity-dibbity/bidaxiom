"use client";

import { useQueryState } from "nuqs";

/**
 * URL-based navigation state management using nuqs.
 * Enables shareable/bookmarkable navigation states.
 *
 * Example: /projects?view=grid&status=active
 */

export function useNavigationState() {
  const [view, setView] = useQueryState("view", {
    defaultValue: "list",
    shallow: true, // Don't trigger navigation
  });

  const [status, setStatus] = useQueryState("status", {
    defaultValue: "all",
    shallow: true,
  });

  return {
    view,
    setView,
    status,
    setStatus,
  };
}

// Future: Add more navigation state helpers as needed
