"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, configureAuthRefresh } from "./api";
import { clearCheckoutSessionStorage } from "./checkout-session";
import type { ApiRole, AuthUser, LoginResponse } from "./types";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<AuthUser | null>;
  register: (payload: RegisterPayload) => Promise<AuthUser | null>;
  loginWithGoogle: (credential: string) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
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
  const sessionRestorePromise = useRef<Promise<string | null> | null>(null);
  const authChangeVersion = useRef(0);

  const persistToken = useCallback((nextToken: string | null) => {
    setToken(nextToken);
  }, []);

  const requestRefresh = useCallback(async () => {
    const response = await apiRequest<LoginResponse>("/api/auth/refresh", {
      method: "POST",
      retryOnUnauthorized: false,
      timeoutMs: 8000,
    });
    return response.token;
  }, []);

  const refresh = useCallback(async () => {
    const requestVersion = authChangeVersion.current;
    const nextToken = await requestRefresh();
    if (requestVersion !== authChangeVersion.current) {
      return null;
    }

    persistToken(nextToken);
    setIsReady(true);
    return nextToken;
  }, [persistToken, requestRefresh]);

  useEffect(function configureApiRefresh() {
    configureAuthRefresh(async () => {
      const requestVersion = authChangeVersion.current;
      try {
        return await refresh();
      } catch {
        if (requestVersion === authChangeVersion.current) {
          persistToken(null);
        }
        return null;
      }
    });

    return () => configureAuthRefresh(null);
  }, [persistToken, refresh]);

  useEffect(function restoreSessionFromCookie() {
    let isActive = true;

    const restoreVersion = authChangeVersion.current;
    let restoreRequest = sessionRestorePromise.current;
    if (!restoreRequest) {
      restoreRequest = requestRefresh();
      sessionRestorePromise.current = restoreRequest;
      restoreRequest.then(
        () => {
          if (sessionRestorePromise.current === restoreRequest) {
            sessionRestorePromise.current = null;
          }
        },
        () => {
          if (sessionRestorePromise.current === restoreRequest) {
            sessionRestorePromise.current = null;
          }
        },
      );
    }

    restoreRequest
      .then((nextToken) => {
        if (isActive && restoreVersion === authChangeVersion.current) {
          persistToken(nextToken);
        }
      })
      .catch(() => {
        if (isActive && restoreVersion === authChangeVersion.current) {
          persistToken(null);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsReady(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, [persistToken, requestRefresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      authChangeVersion.current += 1;
      const response = await apiRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      persistToken(response.token);
      setIsReady(true);
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
      authChangeVersion.current += 1;
      const response = await apiRequest<LoginResponse>("/api/auth/google", {
        method: "POST",
        body: {
          credential,
          deviceInfo: typeof navigator === "undefined" ? undefined : navigator.userAgent,
        },
      });
      persistToken(response.token);
      setIsReady(true);
      return decodeJwtUser(response.token);
    },
    [persistToken],
  );

  const logout = useCallback(async () => {
    authChangeVersion.current += 1;
    try {
      await apiRequest<void>("/api/auth/logout", {
        method: "POST",
        token,
      });
    } finally {
      clearCheckoutSessionStorage();
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
