"use client";

import { useCallback, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type UseAutoSaveOptions<T> = {
  onSave: (data: T) => Promise<unknown>;
  debounceMs?: number;
};

export function useAutoSave<T>({ onSave, debounceMs = 1000 }: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<T | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (data: T) => {
      setStatus("saving");
      try {
        await onSave(data);
        setStatus("saved");
        // Clear any existing "saved" fade timer
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setStatus("idle"), 3000);
      } catch {
        setStatus("error");
      }
    },
    [onSave]
  );

  const trigger = useCallback(
    (data: T) => {
      pendingDataRef.current = data;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (pendingDataRef.current !== null) {
          save(pendingDataRef.current);
          pendingDataRef.current = null;
        }
      }, debounceMs);
    },
    [save, debounceMs]
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingDataRef.current !== null) {
      save(pendingDataRef.current);
      pendingDataRef.current = null;
    }
  }, [save]);

  return { status, trigger, flush };
}
