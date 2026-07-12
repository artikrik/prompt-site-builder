function resolveApiBase(): string {
  // Client-side: derive API URL from the browser's location.
  //   localhost / 127.0.0.1 → http://localhost:3000 (dev)
  //   production            → {origin}/api (Caddy proxies /api/* → backend:3000)
  // SSR fallback: build-time env var or dev default
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return 'http://localhost:3000';
    }
    // Same-origin API path — avoids DNS dependency on api.* subdomain
    return `${window.location.origin}/api`;
  }

  // SSR fallback: use build-time env var or dev default
  return import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';
}

const API_BASE = resolveApiBase();

interface RequestConfig {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  _retry?: boolean;
}

class ApiClient {
  private token: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async refreshToken(): Promise<string | null> {
    // deduplicate concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json() as { accessToken: string };
        this.token = data.accessToken;
        return data.accessToken;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { method = 'GET', headers = {}, body, _retry = false } = config;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.token) {
      requestHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    // token refresh on 401 — try once, then fail
    if (response.status === 401 && !_retry && endpoint !== '/auth/refresh') {
      const newToken = await this.refreshToken();
      if (newToken) {
        return this.request<T>(endpoint, { method, headers, body, _retry: true });
      }
      // refresh failed — notify auth store to logout
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
