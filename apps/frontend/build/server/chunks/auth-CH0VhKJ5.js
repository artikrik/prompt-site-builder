import { m as derived, w as writable } from './index.js-C88fsYC1.js';
import { a as api } from './client2-DL3MN81r.js';

function createAuthStore() {
  let state = {
    user: null,
    token: null,
    isLoading: false,
    isInitialized: false,
    error: null
  };
  const { subscribe, set, update } = writable(state);
  subscribe((s) => {
    state = s;
  });
  async function loadUser() {
    try {
      const user = await api.get("/auth/me");
      update((s) => ({ ...s, user }));
    } catch {
    }
  }
  return {
    subscribe,
    async login(email, password) {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const { accessToken } = await api.post("/auth/login", { email, password });
        api.setToken(accessToken);
        await loadUser();
        update((s) => ({ ...s, token: accessToken, isLoading: false }));
      } catch (error) {
        update((s) => ({ ...s, isLoading: false, error: error instanceof Error ? error.message : "Login failed" }));
        throw error;
      }
    },
    async register(email, password, name) {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const { accessToken } = await api.post("/auth/register", { email, password, name });
        api.setToken(accessToken);
        await loadUser();
        update((s) => ({ ...s, token: accessToken, isLoading: false }));
      } catch (error) {
        update((s) => ({ ...s, isLoading: false, error: error instanceof Error ? error.message : "Registration failed" }));
        throw error;
      }
    },
    async logout() {
      try {
        await api.post("/auth/logout");
      } catch {
      }
      api.setToken(null);
      set({ user: null, token: null, isLoading: false, isInitialized: true, error: null });
    },
    async initialize() {
      if (state.isInitialized) return;
      update((s) => ({ ...s, isLoading: true }));
      try {
        const { accessToken } = await api.post("/auth/refresh");
        api.setToken(accessToken);
        await loadUser();
        update((s) => ({ ...s, token: accessToken, isLoading: false, isInitialized: true }));
      } catch {
        update((s) => ({ ...s, isLoading: false, isInitialized: true }));
      }
    }
  };
}
const auth = createAuthStore();
derived(auth, ($auth) => !!$auth.token);
if (typeof window !== "undefined") {
  window.addEventListener("auth:session-expired", () => {
    auth.logout();
    window.location.href = "/auth/login";
  });
}

export { auth as a };
//# sourceMappingURL=auth-CH0VhKJ5.js.map
