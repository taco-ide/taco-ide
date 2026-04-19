// API client for Fastify backend - Compatible with Kubb generated hooks
import { authClient } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Evita vários pedidos 401 a dispararem redirecionamentos em paralelo. */
let sessionExpiredRedirectScheduled = false;

/**
 * Sessão inválida (cookie antigo, DB reset, etc.): termina sessão no cliente e vai ao login.
 * Não corre em rotas /auth/* para não interferir com login explícito.
 */
function handleUnauthorizedSession(): void {
  if (typeof window === "undefined") return;
  if (sessionExpiredRedirectScheduled) return;
  const path = window.location.pathname;
  if (path.startsWith("/auth")) return;

  sessionExpiredRedirectScheduled = true;
  void (async () => {
    try {
      await authClient.signOut();
    } catch {
      // Cookie já inválido — seguimos para o login
    }
    window.location.assign("/auth/login?reason=session_expired");
  })();
}

// Types required by Kubb generated hooks
export type RequestConfig<TData = unknown> = {
  url?: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  params?: Record<string, unknown>;
  data?: TData;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export type ResponseErrorConfig<TError = unknown> = TError;

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string | string[]>;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string | string[]>
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

function parseJsonResponse(
  response: Response,
  text: string
): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    if (!response.ok) {
      throw new ApiError(
        trimmed.slice(0, 500) || "An error occurred",
        response.status
      );
    }
    return {};
  }
}

/**
 * Kubb-compatible API client function
 * This function is used by Kubb generated hooks
 */
async function apiClient<TData = unknown, TError = unknown, TRequest = unknown>(
  config: RequestConfig<TRequest>
): Promise<{ data: TData }> {
  const { url, method, params, data, headers, signal } = config;

  let fullUrl = `${API_BASE_URL}${url}`;

  // Add query params for GET requests
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += `?${queryString}`;
    }
  }

  const body = data !== undefined ? JSON.stringify(data) : undefined;
  const mergedHeaders = new Headers(headers);
  if (body !== undefined && !mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(fullUrl, {
    method,
    credentials: "include",
    headers: mergedHeaders,
    body,
    signal,
  });

  const text = await response.text();
  const responseData = parseJsonResponse(response, text);

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorizedSession();
    }
    const message =
      typeof responseData.message === "string"
        ? responseData.message
        : "An error occurred";
    const errors = responseData.errors as
      | Record<string, string | string[]>
      | undefined;
    throw new ApiError(message, response.status, errors);
  }

  // Kubb generated hooks use res.data - our API returns { success, data?, pagination? }
  // Wrap the full response so res.data = full API response (keeps data + pagination)
  return { data: responseData as TData };
}

export default apiClient;
