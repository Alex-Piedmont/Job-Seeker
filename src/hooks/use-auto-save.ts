"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { SaveError } from "@/lib/save-error";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "retrying";

type UseAutoSaveOptions<T> = {
  onSave: (data: T) => Promise<unknown>;
  onRollback?: (lastSaved: T, message: string) => void;
  initialData: T;
  debounceMs?: number;
};

export function useAutoSave<T>({
  onSave,
  onRollback,
  initialData,
  debounceMs = 1000,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<T | null>(null);
  const lastSavedRef = useRef<T>(initialData);

  // Ref-based callbacks to avoid stale closures
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onRollbackRef = useRef(onRollback);
  onRollbackRef.current = onRollback;

  const rollback = useCallback((message: string) => {
    toast.error(message);
    onRollbackRef.current?.(lastSavedRef.current, message);
    setStatus("error");
  }, []);

  const save = useCallback(
    async (data: T, isRetry = false) => {
      setStatus("saving");
      try {
        await onSaveRef.current(data);
        lastSavedRef.current = data;
        setStatus("saved");
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setStatus("idle"), 3000);
      } catch (err) {
        const saveErr =
          err instanceof SaveError ? err : new SaveError("Save failed", 0);

        if (saveErr.isRetryable && !isRetry) {
          setStatus("retrying");
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            save(data, true);
          }, 3000);
        } else {
          rollback(saveErr.message);
        }
      }
    },
    [rollback]
  );

  const trigger = useCallback(
    (data: T) => {
      pendingDataRef.current = data;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      debounceTimerRef.current = setTimeout(() => {
        if (pendingDataRef.current !== null) {
          save(pendingDataRef.current);
          pendingDataRef.current = null;
        }
      }, debounceMs);
    },
    [save, debounceMs]
  );

  const flush = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (pendingDataRef.current !== null) {
      const data = pendingDataRef.current;
      pendingDataRef.current = null;
      // Best-effort: no retry, no rollback, no toast on failure
      setStatus("saving");
      onSaveRef.current(data)
        .then(() => {
          lastSavedRef.current = data;
          setStatus("saved");
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setStatus("idle"), 3000);
        })
        .catch(() => {
          // Silent failure on flush - best effort
        });
    }
  }, []);

  return { status, trigger, flush };
}
