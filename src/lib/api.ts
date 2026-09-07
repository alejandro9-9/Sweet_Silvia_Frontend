import type { ApiError } from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8080";

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
  retryOnUnauthorized?: boolean;
};

type AuthRefreshHandler = () => Promise<string | null>;

let authRefreshHandler: AuthRefreshHandler | null = null;
let authRefreshPromise: Promise<string | null> | null = null;

export function configureAuthRefresh(handler: AuthRefreshHandler | null) {
  authRefreshHandler = handler;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: ApiError | null,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { body, token, headers, retryOnUnauthorized = true, ...init } = options;
  const isFormData = body instanceof FormData;

  const createFetchOptions = (activeToken: string | null | undefined): RequestInit => ({
    ...init,
    body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      ...headers,
    },
  });

  let response = await fetch(`${API_URL}${path}`, createFetchOptions(token));

 if (response.status === 401 && token && retryOnUnauthorized && authRefreshHandler && path !== "/api/auth/refresh") {
    const refreshHandler = authRefreshHandler;
    authRefreshPromise ??= refreshHandler().finally(() => {
      authRefreshPromise = null;
    });

    const refreshedToken = await authRefreshPromise;
    if (refreshedToken) {
      response = await fetch(`${API_URL}${path}`, createFetchOptions(refreshedToken));
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const message =
      payload?.message ?? payload?.error ?? payload?.detail ?? payload?.title ?? "La solicitud no pudo completarse.";
    throw new ApiClientError(message, response.status, payload);
  }

  return payload as T;
}

export function publicAssetUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
