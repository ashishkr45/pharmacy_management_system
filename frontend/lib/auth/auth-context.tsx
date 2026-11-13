"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "@/lib/api/client";
import { clearApiCache } from "@/lib/api/cache";
import type { LoginResult, User } from "@/lib/api/types";
import {
  clearSession,
  getToken,
  saveToken,
  UNAUTHORIZED_EVENT,
} from "@/lib/auth/session";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // The token is only an identifier: `/auth/me` re-reads the user so a
  // deactivated account or a changed role is reflected on page load.
  useEffect(() => {
    let active = true;

    async function hydrate() {
      // Defer the first state update by one microtask so the effect only
      // synchronises with the stored token, rather than cascading renders.
      await Promise.resolve();
      if (!active) {
        return;
      }

      const token = getToken();
      if (!token) {
        setStatus("anonymous");
        return;
      }

      try {
        const currentUser = await apiRequest<User>("/auth/me");
        if (!active) {
          return;
        }

        setUser(currentUser);
        setStatus("authenticated");
      } catch {
        if (!active) {
          return;
        }

        clearSession();
        clearApiCache();
        setUser(null);
        setStatus("anonymous");
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, []);

  // Any 401 outside this provider (e.g. from a page-level request) ends the
  // session so guards send the user back to login.
  useEffect(() => {
    const handleUnauthorized = () => {
      clearApiCache();
      setUser(null);
      setStatus("anonymous");
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiRequest<LoginResult>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });

    // Never let data cached for a previous session survive a new login.
    clearApiCache();
    saveToken(result.token);
    setUser(result.user);
    setStatus("authenticated");
    return result.user;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    clearApiCache();
    setUser(null);
    setStatus("anonymous");
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }

  return context;
}
