"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ApiError, apiRequestPage } from "@/lib/api/client";
import {
  getApiCacheVersion,
  getApiInvalidationVersion,
  getCachedApi,
  setCachedApi,
  subscribeApiCache,
} from "@/lib/api/cache";
import type { PaginatedResponse } from "@/lib/api/types";

/** Lists revalidate in the background after a short freshness window. */
export const DEFAULT_API_STALE_TIME = 30_000;

/** Reference data (dropdowns) changes rarely and is invalidated explicitly. */
export const REFERENCE_DATA_STALE_TIME = 5 * 60_000;

interface ApiListResult<T> {
  path: string;
  data: PaginatedResponse<T> | null;
  error: string | null;
}

interface UseApiListOptions {
  staleTime?: number;
}

/**
 * Loads a paginated endpoint through the path-keyed cache.
 *
 * The cached page renders immediately. If it is older than `staleTime`, a
 * background request refreshes it; a fresh cache avoids the request entirely.
 * `reload()` forces a request (used by error retry buttons), and cache
 * invalidation triggers a request for the current path.
 */
export function useApiList<T>(
  path: string,
  options: UseApiListOptions = {},
) {
  const { staleTime = DEFAULT_API_STALE_TIME } = options;
  const [reloadKey, setReloadKey] = useState(0);
  const lastReloadKey = useRef(0);
  const [state, setState] = useState<ApiListResult<T>>({
    path,
    data: null,
    error: null,
  });

  // Re-render when another hook writes/invalidates an entry.
  useSyncExternalStore(
    subscribeApiCache,
    getApiCacheVersion,
    getApiCacheVersion,
  );
  const invalidationVersion = useSyncExternalStore(
    subscribeApiCache,
    getApiInvalidationVersion,
    getApiInvalidationVersion,
  );

  const cached = getCachedApi<PaginatedResponse<T>>(path);
  const current = state.path === path ? state : null;
  const data = current?.data ?? cached?.data ?? null;
  const error = data === null ? (current?.error ?? null) : null;
  const isLoading = data === null && error === null;

  useEffect(() => {
    const forceReload = reloadKey !== lastReloadKey.current;
    lastReloadKey.current = reloadKey;

    const cachedEntry = getCachedApi<PaginatedResponse<T>>(path);
    const isFresh =
      cachedEntry !== undefined &&
      Date.now() - cachedEntry.updatedAt < staleTime;

    if (isFresh && !forceReload) {
      // Keep the current path's data in local state too, so evicting the
      // cache entry cannot blank a list that is still on screen.
      setState((previous) =>
        previous.path === path && previous.data !== null
          ? previous
          : { path, data: cachedEntry.data, error: null },
      );
      return;
    }

    let active = true;

    // Clear an old error while keeping any visible data in place.
    setState((previous) =>
      previous.path === path && previous.error === null
        ? previous
        : {
            path,
            data: previous.path === path ? previous.data : null,
            error: null,
          },
    );

    apiRequestPage<T>(path)
      .then((nextData) => {
        if (!active) {
          return;
        }
        setCachedApi(path, nextData);
        setState({ path, data: nextData, error: null });
      })
      .catch((cause: unknown) => {
        if (!active) {
          return;
        }

        // A stale cache is better than replacing real data with an error.
        setState((previous) => {
          if (
            getCachedApi(path) !== undefined ||
            (previous.path === path && previous.data !== null)
          ) {
            return previous;
          }

          return {
            path,
            data: null,
            error:
              cause instanceof ApiError
                ? cause.message
                : "The list could not be loaded.",
          };
        });
      });

    return () => {
      active = false;
    };
  }, [path, reloadKey, staleTime, invalidationVersion]);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return {
    data,
    isLoading,
    error,
    reload,
  };
}
