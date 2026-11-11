const TOKEN_KEY = "meditrack.access-token";

/** Fired when the API rejects a request with 401 so the auth provider can reset. */
export const UNAUTHORIZED_EVENT = "meditrack:unauthorized";

// localStorage is unavailable during SSR and can be blocked in private modes.
// The in-memory copy keeps the current tab usable either way.
let memoryToken: string | null = null;

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return memoryToken;
  }

  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function saveToken(token: string): void {
  memoryToken = token;

  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // The in-memory session still covers this tab.
  }
}

export function clearSession(): void {
  memoryToken = null;

  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing else to clear.
  }
}

export function notifyUnauthorized(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}
