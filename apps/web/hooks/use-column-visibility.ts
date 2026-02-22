import { useState, useCallback } from "react";
import type { VisibilityState, Updater } from "@tanstack/react-table";

export function useColumnVisibility(tableKey: string) {
  const storageKey = `col-picker:${tableKey}`;

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? (JSON.parse(stored) as VisibilityState) : {};
    } catch {
      return {};
    }
  });

  const onColumnVisibilityChange = useCallback(
    (updater: Updater<VisibilityState>) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* storage unavailable — degrade silently */
        }
        return next;
      });
    },
    [storageKey]
  );

  return { columnVisibility, onColumnVisibilityChange };
}
