"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ApiError, apiRequest } from "@/lib/api/client";
import {
  getApiCacheVersion,
  getApiInvalidationVersion,
  getCachedApi,
  setCachedApi,
  subscribeApiCache,
} from "@/lib/api/cache";
import { DEFAULT_API_STALE_TIME } from "@/lib/hooks/use-api-list";

interface ApiItemResult<T> {
  path: string;
  data: T | null;
  error: string | null;
}

interface UseApiItemOptions {
  staleTime?: number;
}

/**
 * Loads a single-resource endpoint through the same path-keyed cache as
 * `useApiList`. Pass `null` to skip loading (for example when a route id is
 * invalid).
 */
export function useApiItem<T>(
  path: string | null,
  options: UseApiItemOptions = {},
) {
  const { staleTime = DEFAULT_API_STALE_TIME } = options;
  const [reloadKey, setReloadKey] = useState(0);
  const lastReloadKey = useRef(0);
  const [state, setState] = useState<ApiItemResult<T>>({
    path: path ?? "",
    data: null,
    error: null,
  });

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

  const cached = path === null ? undefined : getCachedApi<T>(path);
  const current = path !== null && state.path === path ? state : null;
  const data = current?.data ?? cached?.data ?? null;
  const error = data === null ? (current?.error ?? null) : null;
  const isLoading = path !== null && data === null && error === null;

  useEffect(() => {
    if (path === null) {
      return;
    }

    const forceReload = reloadKey !== lastReloadKey.current;
    lastReloadKey.current = reloadKey;

    const cachedEntry = getCachedApi<T>(path);
    const isFresh =
      cachedEntry !== undefined &&
      Date.now() - cachedEntry.updatedAt < staleTime;

    if (isFresh && !forceReload) {
      // Keep the current path's data in local state too, so evicting the
      // cache entry cannot blank a detail view that is still on screen.
      setState((previous) =>
        previous.path === path && previous.data !== null
          ? previous
          : { path, data: cachedEntry.data, error: null },
      );
      return;
    }

    let active = true;

    setState((previous) =>
      previous.path === path && previous.error === null
        ? previous
        : {
            path,
            data: previous.path === path ? previous.data : null,
            error: null,
          },
    );

    apiRequest<T>(path)
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
                : "The record could not be loaded.",
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
