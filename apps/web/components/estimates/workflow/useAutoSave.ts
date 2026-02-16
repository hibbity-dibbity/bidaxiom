import { useEffect, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import { useIsMutating } from '@tanstack/react-query';

/**
 * Auto-save hook with debouncing and race condition prevention
 *
 * Features:
 * - Debounces saves to reduce API calls
 * - Prevents concurrent saves using React Query mutation tracking
 * - Skips initial render to avoid saving unchanged data
 * - Returns saving status for UI feedback
 */
interface AutoSaveOptions {
  data: any;
  onSave: (data: any) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

export function useAutoSave({
  data,
  onSave,
  debounceMs = 500,
  enabled = true,
}: AutoSaveOptions) {
  const [debouncedData] = useDebounce(data, debounceMs);
  const previousDataRef = useRef(data);
  const isMutating = useIsMutating();
  const isInitialRender = useRef(true);

  useEffect(() => {
    // Skip initial render
    if (isInitialRender.current) {
      isInitialRender.current = false;
      previousDataRef.current = debouncedData;
      return;
    }

    // Don't save if disabled or if a mutation is already in progress
    if (!enabled || isMutating > 0) {
      return;
    }

    // Check if data has actually changed
    const hasChanged =
      JSON.stringify(previousDataRef.current) !== JSON.stringify(debouncedData);

    if (hasChanged) {
      onSave(debouncedData).catch((error) => {
        console.error('Auto-save failed:', error);
      });
      previousDataRef.current = debouncedData;
    }
  }, [debouncedData, onSave, enabled, isMutating]);

  return {
    isSaving: isMutating > 0,
  };
}
