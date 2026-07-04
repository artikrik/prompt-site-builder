import { writable, derived } from 'svelte/store';
import { api } from '$lib/api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

function createAuthStore() {
  let state: AuthState = {
    user: null,
    token: null,
    isLoading: false,
    isInitialized: false,
    error: null,
  };

  const { subscribe, set, update } = writable<AuthState>(state);

  // keep local copy for initialize() self-check
  subscribe((s) => { state = s; });

  async function loadUser() {
    try {
      const user = await api.get<User>('/auth/me');
      update((s) => ({ ...s, user }));
    } catch {
      // /me failed — token might be invalid
    }
  }

  return {
    subscribe,
    async login(email: string, password: string) {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const { accessToken } = await api.post<{ accessToken: string }>('/auth/login', { email, password });
        api.setToken(accessToken);
        await loadUser();
        update((s) => ({ ...s, token: accessToken, isLoading: false }));
      } catch (error) {
        update((s) => ({ ...s, isLoading: false, error: error instanceof Error ? error.message : 'Login failed' }));
        throw error;
      }
    },
    async register(email: string, password: string, name: string) {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const { accessToken } = await api.post<{ accessToken: string }>('/auth/register', { email, password, name });
        api.setToken(accessToken);
        await loadUser();
        update((s) => ({ ...s, token: accessToken, isLoading: false }));
      } catch (error) {
        update((s) => ({ ...s, isLoading: false, error: error instanceof Error ? error.message : 'Registration failed' }));
        throw error;
      }
    },
    async logout() {
      try {
        await api.post('/auth/logout');
      } catch {
        // ignore errors — clear local state regardless
      }
      api.setToken(null);
      set({ user: null, token: null, isLoading: false, isInitialized: true, error: null });
    },
    async initialize() {
      if (state.isInitialized) return;
      update((s) => ({ ...s, isLoading: true }));
      try {
        const { accessToken } = await api.post<{ accessToken: string }>('/auth/refresh');
        api.setToken(accessToken);
        await loadUser();
        update((s) => ({ ...s, token: accessToken, isLoading: false, isInitialized: true }));
      } catch {
        // no valid refresh token — user must login
        update((s) => ({ ...s, isLoading: false, isInitialized: true }));
      }
    },
  };
}

export const auth = createAuthStore();
export const isAuthenticated = derived(auth, ($auth) => !!$auth.token);

// listen for session expiry from API client's failed refresh attempts
if (typeof window !== 'undefined') {
  window.addEventListener('auth:session-expired', () => {
    auth.logout();
    window.location.href = '/auth/login';
  });
}
