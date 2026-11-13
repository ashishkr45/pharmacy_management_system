/**
 * Tiny client-side API cache.
 *
 * Two counters keep the hooks correct:
 * - `cacheVersion` changes whenever data is written or invalidated, so every
 *   mounted hook re-renders and reads the latest entry.
 * - `invalidationVersion` changes only when data is invalidated, so effects
 *   revalidate after a write without re-fetching every time a cache entry is
 *   written.
 *
 * Entries are keyed by the full request path (filters, search and page included)
 * and capped so a long search session cannot grow memory without bound.
 */
const MAX_CACHE_ENTRIES = 100;

export interface ApiCacheEntry<T> {
  data: T;
  updatedAt: number;
}

const cache = new Map<string, ApiCacheEntry<unknown>>();
const listeners = new Set<() => void>();
let cacheVersion = 0;
let invalidationVersion = 0;

function notify(): void {
  cacheVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function getCachedApi<T>(key: string): ApiCacheEntry<T> | undefined {
  return cache.get(key) as ApiCacheEntry<T> | undefined;
}

export function setCachedApi<T>(key: string, data: T): void {
  // Re-insert so the oldest written key is evicted first.
  cache.delete(key);
  cache.set(key, { data, updatedAt: Date.now() });

  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }

  notify();
}

/**
 * Drops every entry whose key starts with one of the prefixes (for example
 * `/categories` clears both the list and the dropdown query). With no
 * prefixes, drops everything and asks mounted hooks to revalidate. Use
 * `clearApiCache` instead when a session is ending.
 */
export function invalidateApiCache(prefixes?: string | readonly string[]): void {
  const selected =
    prefixes === undefined
      ? null
      : typeof prefixes === "string"
        ? [prefixes]
        : prefixes;

  for (const key of [...cache.keys()]) {
    if (
      selected === null ||
      selected.some((prefix) => key.startsWith(prefix))
    ) {
      cache.delete(key);
    }
  }

  invalidationVersion += 1;
  notify();
}

export function clearApiCache(): void {
  // A session is ending: drop entries without asking mounted screens to
  // revalidate with a token that has just been cleared.
  cache.clear();
  notify();
}

export function subscribeApiCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getApiCacheVersion(): number {
  return cacheVersion;
}

export function getApiInvalidationVersion(): number {
  return invalidationVersion;
}
