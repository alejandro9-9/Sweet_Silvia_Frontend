"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, configureAuthRefresh } from "./api";
import type { ApiRole, AuthUser, LoginResponse } from "./types";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<AuthUser | null>;
  register: (payload: RegisterPayload) => Promise<AuthUser | null>;
  loginWithGoogle: (credential: string) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<string>;
};

export type RegisterPayload = {
  name: string;
  paternalSurname: string;
  maternalSurname: string | null;
  phone: string;
  email: string;
  password: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const didRestoreSession = useRef(false);

  const persistToken = useCallback((nextToken: string | null) => {
    setToken(nextToken);
  }, []);

  const refresh = useCallback(async () => {
    const response = await apiRequest<LoginResponse>("/api/auth/refresh", {
      method: "POST",
      retryOnUnauthorized: false,
    });
    persistToken(response.token);
    return response.token;
  }, [persistToken]);

  useEffect(function configureApiRefresh() {
    configureAuthRefresh(async () => {
      try {
        return await refresh();
      } catch {
        persistToken(null);
        return null;
      }
    });

    return () => configureAuthRefresh(null);
  }, [persistToken, refresh]);

  useEffect(function restoreSessionFromCookie() {
    if (didRestoreSession.current) {
      return;
    }

    didRestoreSession.current = true;
    let isActive = true;

    refresh()
      .catch(() => persistToken(null))
      .finally(() => {
        if (isActive) {
          setIsReady(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, [persistToken, refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      persistToken(response.token);
      return decodeJwtUser(response.token);
    },
    [persistToken],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await apiRequest<{ id: string }>("/api/users", {
        method: "POST",
        body: payload,
      });

      return login(payload.email, payload.password);
    },
    [login],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const response = await apiRequest<LoginResponse>("/api/auth/google", {
        method: "POST",
        body: {
          credential,
          deviceInfo: typeof navigator === "undefined" ? undefined : navigator.userAgent,
        },
      });
      persistToken(response.token);
      return decodeJwtUser(response.token);
    },
    [persistToken],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>("/api/auth/logout", {
        method: "POST",
        token,
      });
    } finally {
      persistToken(null);
    }
  }, [persistToken, token]);

  const user = useMemo(() => (token ? decodeJwtUser(token) : null), [token]);

  const value = useMemo(
    () => ({ token, user, isReady, login, register, loginWithGoogle, logout, refresh }),
    [token, user, isReady, login, register, loginWithGoogle, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }

  return context;
}

function decodeJwtUser(token: string): AuthUser | null {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));

    return {
      id: json.nameid ?? json.sub ?? json["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"],
      email: json.email ?? json["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
      role: json.role ?? json["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] as ApiRole,
      roleId: json.roleId,
    };
  } catch {
    return null;
  }
}
