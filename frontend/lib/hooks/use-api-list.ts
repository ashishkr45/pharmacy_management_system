"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequestPage } from "@/lib/api/client";
import type { PaginatedResponse } from "@/lib/api/types";

interface ApiListResult<T> {
  key: string;
  data: PaginatedResponse<T> | null;
  error: string | null;
}

/**
 * Loads a paginated endpoint. Pass a stable path string; changing it (page,
 * filters, search) triggers a new request and ignores the previous response.
 */
export function useApiList<T>(path: string) {
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${path}::${reloadKey}`;
  const [result, setResult] = useState<ApiListResult<T> | null>(null);

  useEffect(() => {
    let active = true;

    apiRequestPage<T>(path)
      .then((data) => {
        if (active) {
          setResult({ key: requestKey, data, error: null });
        }
      })
      .catch((cause: unknown) => {
        if (!active) {
          return;
        }

        setResult({
          key: requestKey,
          data: null,
          error:
            cause instanceof ApiError
              ? cause.message
              : "The list could not be loaded.",
        });
      });

    return () => {
      active = false;
    };
  }, [path, requestKey]);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const current = result?.key === requestKey ? result : null;

  return {
    data: current?.data ?? null,
    isLoading: current === null,
    error: current?.error ?? null,
    reload,
  };
}
