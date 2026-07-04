import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock api client before importing auth store
vi.mock('$lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    setToken: vi.fn(),
  },
}));

import { auth, isAuthenticated } from './auth';
import { api } from '$lib/api/client';

describe('Auth Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state by logging out
    auth.logout();
  });

  describe('login', () => {
    it('should set token on successful login', async () => {
      const mockApi = api as unknown as { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; setToken: ReturnType<typeof vi.fn> };
      mockApi.post.mockResolvedValueOnce({ accessToken: 'test-token' });
      mockApi.get.mockResolvedValueOnce({ id: '1', email: 'test@test.com', name: 'Test', role: 'admin' });

      await auth.login('test@test.com', 'password');

      const state = get(auth);
      expect(state.token).toBe('test-token');
      expect(state.user).toEqual({ id: '1', email: 'test@test.com', name: 'Test', role: 'admin' });
      expect(mockApi.setToken).toHaveBeenCalledWith('test-token');
    });

    it('should set error on failed login', async () => {
      const mockApi = api as unknown as { post: ReturnType<typeof vi.fn> };
      mockApi.post.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(auth.login('test@test.com', 'wrong')).rejects.toThrow('Invalid credentials');

      const state = get(auth);
      expect(state.error).toBe('Invalid credentials');
      expect(state.token).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear state', async () => {
      const mockApi = api as unknown as { post: ReturnType<typeof vi.fn>; setToken: ReturnType<typeof vi.fn> };
      mockApi.post.mockResolvedValueOnce({});

      await auth.logout();

      const state = get(auth);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isInitialized).toBe(true);
      expect(mockApi.setToken).toHaveBeenCalledWith(null);
    });
  });

  describe('isAuthenticated', () => {
    it('should derive from auth token', () => {
      // After logout, should be false
      expect(get(isAuthenticated)).toBe(false);
    });
  });
});
