const API_BASE = "http://localhost:3000";
class ApiClient {
  token = null;
  refreshPromise = null;
  setToken(token) {
    this.token = token;
  }
  async refreshToken() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" }
        });
        if (!response.ok) {
          return null;
        }
        const data = await response.json();
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
  async request(endpoint, config = {}) {
    const { method = "GET", headers = {}, body, _retry = false } = config;
    const requestHeaders = {
      "Content-Type": "application/json",
      ...headers
    };
    if (this.token) {
      requestHeaders["Authorization"] = `Bearer ${this.token}`;
    }
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : void 0,
      credentials: "include"
    });
    if (response.status === 401 && !_retry && endpoint !== "/auth/refresh") {
      const newToken = await this.refreshToken();
      if (newToken) {
        return this.request(endpoint, { method, headers, body, _retry: true });
      }
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    if (response.status === 204) {
      return null;
    }
    return response.json();
  }
  get(endpoint) {
    return this.request(endpoint);
  }
  post(endpoint, body) {
    return this.request(endpoint, { method: "POST", body });
  }
  put(endpoint, body) {
    return this.request(endpoint, { method: "PUT", body });
  }
  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }
}
const api = new ApiClient();

export { api as a };
//# sourceMappingURL=client2-DL3MN81r.js.map
