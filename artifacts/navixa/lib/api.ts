/**
 * Navixa — typed REST client for the api-server.
 *
 * Every call is prefixed with `/api` and hits the shared proxy at
 * `https://${EXPO_PUBLIC_DOMAIN}` (Expo bundles run outside the proxy so an
 * absolute URL is required). Authentication uses a Clerk session JWT attached
 * as `Authorization: Bearer <token>`; the token getter is registered once from
 * a component with access to Clerk's `useAuth().getToken` via
 * `setAuthTokenGetter`.
 *
 * The server speaks a stable error envelope `{ error: { code, message } }`
 * which is unwrapped here into a thrown `ApiError`.
 */

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'ApiError';
  }
}

type TokenGetter = () => Promise<string | null> | string | null;

let tokenGetter: TokenGetter | null = null;

/**
 * Register the bearer-token getter. Call this once from a component that has
 * access to Clerk's `useAuth().getToken`. The getter runs before every request.
 */
export function setAuthTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON body; serialised automatically. */
  body?: unknown;
  /** Optional query params appended to the path. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Extra headers merged over the defaults. */
  headers?: Record<string, string>;
}

function buildUrl(path: string, query?: ApiFetchOptions['query']): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const withApi = clean.startsWith('/api/') || clean === '/api' ? clean : `/api${clean}`;
  const url = `${BASE_URL}${withApi}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Perform an authenticated JSON request against the api-server. Returns the
 * parsed JSON body typed as `T`. Throws `ApiError` on the error envelope or a
 * non-2xx response.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = 'GET', body, query, headers: extraHeaders } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (tokenGetter) {
    try {
      const token = await tokenGetter();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // No token available — request proceeds unauthenticated and the server
      // returns 401, surfaced below as an ApiError.
    }
  }

  const url = buildUrl(path, query);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError('NETWORK_ERROR', (err as Error)?.message ?? 'Network request failed', 0);
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const env = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      env?.code ?? 'HTTP_ERROR',
      env?.message ?? `Request failed with status ${res.status}`,
      res.status,
    );
  }

  // Success responses may still carry an envelope in edge cases.
  if (json && typeof json === 'object' && 'error' in json && (json as { error?: unknown }).error) {
    const env = (json as { error: { code?: string; message?: string } }).error;
    throw new ApiError(env.code ?? 'API_ERROR', env.message ?? 'Request failed', res.status);
  }

  return json as T;
}
