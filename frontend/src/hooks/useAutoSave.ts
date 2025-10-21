import { useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
  delay?: number; // Delay in milliseconds before auto-save triggers
  enabled?: boolean; // Whether auto-save is enabled
}

interface UseAutoSaveReturn {
  triggerSave: () => void;
  isSaving: boolean;
  lastSaved: Date | null;
}

export function useAutoSave(
  data: any,
  saveFunction: (data: any) => Promise<void>,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn {
  const { delay = 2000, enabled = true } = options;
  
  const timeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const lastSavedRef = useRef<Date | null>(null);
  const previousDataRef = useRef<any>(null);

  const triggerSave = useCallback(async () => {
    if (isSavingRef.current || !enabled) return;

    try {
      isSavingRef.current = true;
      await saveFunction(data);
      lastSavedRef.current = new Date();
      previousDataRef.current = data;
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      isSavingRef.current = false;
    }
  }, [data, saveFunction, enabled]);

  const debouncedSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      triggerSave();
    }, delay);
  }, [triggerSave, delay]);

  useEffect(() => {
    // Don't auto-save if data hasn't changed or if it's the initial render
    if (!enabled || !data || JSON.stringify(data) === JSON.stringify(previousDataRef.current)) {
      return;
    }

    // Skip auto-save on initial render (when previousDataRef is null)
    if (previousDataRef.current === null) {
      previousDataRef.current = data;
      return;
    }

    debouncedSave();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, debouncedSave, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    triggerSave,
    isSaving: isSavingRef.current,
    lastSaved: lastSavedRef.current
  };
}