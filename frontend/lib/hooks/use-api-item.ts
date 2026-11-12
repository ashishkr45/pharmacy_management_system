"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api/client";

interface ApiItemResult<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Loads a single-resource endpoint, ignoring responses for an older request.
 * Pass `null` to skip loading (for example when a route id is invalid).
 */
export function useApiItem<T>(path: string | null) {
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = path === null ? null : `${path}::${reloadKey}`;
  const [result, setResult] = useState<ApiItemResult<T> | null>(null);

  useEffect(() => {
    if (path === null || requestKey === null) {
      return;
    }

    let active = true;

    apiRequest<T>(path)
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
              : "The record could not be loaded.",
        });
      });

    return () => {
      active = false;
    };
  }, [path, requestKey]);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const current =
    requestKey !== null && result?.key === requestKey ? result : null;

  return {
    data: current?.data ?? null,
    isLoading: requestKey !== null && current === null,
    error: current?.error ?? null,
    reload,
  };
}
