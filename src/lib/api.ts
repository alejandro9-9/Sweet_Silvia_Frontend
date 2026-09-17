import type { ApiError } from "./types";
import { clientEnv } from "./env";

export const API_URL =
  clientEnv.apiUrl?.replace(/\/$/, "") ?? "http://localhost:8080";

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
  retryOnUnauthorized?: boolean;
  timeoutMs?: number;
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
  const { body, token, headers, retryOnUnauthorized = true, timeoutMs = 15000, ...init } = options;
  const isFormData = body instanceof FormData;
  const requestControl = createRequestControl(init.signal, timeoutMs);

  const createFetchOptions = (activeToken: string | null | undefined): RequestInit => ({
    ...init,
    signal: requestControl.signal,
    body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      ...headers,
    },
  });

  try {
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
      const message = getApiErrorMessage(payload, "La solicitud no pudo completarse.");
      throw new ApiClientError(message, response.status, payload);
    }

    return payload as T;
  } catch (error) {
    throw toApiClientError(error, "No pudimos conectar con el servidor. Intenta nuevamente.");
  } finally {
    requestControl.dispose();
  }
}

export async function apiDownload(path: string, token: string | null) {
  const requestControl = createRequestControl(undefined, 15000);
  const createFetchOptions = (activeToken: string | null): RequestInit => ({
    signal: requestControl.signal,
    credentials: "include",
    headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
  });

  try {
    let response = await fetch(`${API_URL}${path}`, createFetchOptions(token));

    if (response.status === 401 && token && authRefreshHandler && path !== "/api/auth/refresh") {
      const refreshHandler = authRefreshHandler;
      authRefreshPromise ??= refreshHandler().finally(() => {
        authRefreshPromise = null;
      });

      const refreshedToken = await authRefreshPromise;
      if (refreshedToken) {
        response = await fetch(`${API_URL}${path}`, createFetchOptions(refreshedToken));
      }
    }

    if (!response.ok) {
      const text = await response.text();
      const payload = text ? safeParseJson(text) : null;
      const message = getApiErrorMessage(payload, "El archivo no pudo abrirse.");
      throw new ApiClientError(message, response.status, payload);
    }

    return response.blob();
  } catch (error) {
    throw toApiClientError(error, "No pudimos abrir el archivo. Intenta nuevamente.");
  } finally {
    requestControl.dispose();
  }
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

function getApiErrorMessage(payload: ApiError | null, fallback: string) {
  const directMessage = payload?.message ?? payload?.error ?? payload?.detail;
  if (directMessage) {
    return directMessage;
  }

  const validationMessages = Object.entries(payload?.errors ?? {})
    .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
    .filter(Boolean);

  return validationMessages.length > 0
    ? validationMessages.join(" ")
    : payload?.title ?? fallback;
}

function toApiClientError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new ApiClientError("La solicitud tardo demasiado. Intenta nuevamente.", 0, null);
  }

  return new ApiClientError(fallback, 0, null);
}

function createRequestControl(callerSignal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();

  if (callerSignal?.aborted) {
    controller.abort();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  return {
    signal: controller.signal,
    dispose() {
      globalThis.clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    },
  };
}
