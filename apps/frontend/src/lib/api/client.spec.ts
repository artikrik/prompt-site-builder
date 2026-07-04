import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to test the ApiClient class. Import the module and get the class.
// Since api is a singleton, we test via its public interface.
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;
globalThis.dispatchEvent = vi.fn();

// Import after mocking
import { api } from './client';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.setToken(null);
  });

  it('should make a GET request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const result = await api.get('/test');
    expect(result).toEqual({ data: 'test' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/test',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('should make a POST request with body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: '1' }),
    });

    const result = await api.post('/items', { name: 'Test' });
    expect(result).toEqual({ id: '1' });
    expect(mockFetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });
  });

  it('should include auth header when token is set', async () => {
    api.setToken('test-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await api.get('/protected');
    expect(mockFetch.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer test-token',
    });
  });

  it('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Not found' }),
    });

    await expect(api.get('/missing')).rejects.toThrow('Not found');
  });

  it('should return null for 204 responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    });

    const result = await api.delete('/item');
    expect(result).toBeNull();
  });
});
