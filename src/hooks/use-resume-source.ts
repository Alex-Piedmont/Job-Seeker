"use client";

import { useState, useEffect, useCallback } from "react";
import type { ResumeSourceData } from "@/types/resume-source";

export function useResumeSource() {
  const [data, setData] = useState<ResumeSourceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/resume-source");
      if (!res.ok) throw new Error("Failed to fetch resume source");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const mutate = useCallback(
    (updater: (prev: ResumeSourceData | null) => ResumeSourceData | null) => {
      setData(updater);
    },
    []
  );

  const refetch = fetchData;

  return { data, isLoading, error, mutate, refetch };
}
