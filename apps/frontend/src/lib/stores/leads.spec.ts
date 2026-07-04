import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    setToken: vi.fn(),
  },
}));

import { leads } from './leads';
import { api } from '$lib/api/client';

const mockLeads = [
  { id: '1', businessName: 'Biz A', slug: 'biz-a', phone: null, email: null, address: null, city: 'Kyiv', category: 'salon', description: null, source: 'google', status: 'NEW', tags: [], createdAt: '2026-01-01' },
  { id: '2', businessName: 'Biz B', slug: 'biz-b', phone: null, email: null, address: null, city: 'Lviv', category: 'cafe', description: null, source: 'instagram', status: 'CONTACTED', tags: ['vip'], createdAt: '2026-01-02' },
];

describe('Leads Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch leads', async () => {
    const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };
    mockApi.get.mockResolvedValueOnce(mockLeads);

    await leads.fetchAll();

    const state = get(leads);
    expect(state.leads).toEqual(mockLeads);
    expect(state.isLoading).toBe(false);
  });

  it('should set error on fetch failure', async () => {
    const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));

    await leads.fetchAll();

    const state = get(leads);
    expect(state.error).toBe('Network error');
  });

  it('should create lead', async () => {
    const mockApi = api as unknown as { post: ReturnType<typeof vi.fn> };
    mockApi.post.mockResolvedValueOnce({ id: '3', businessName: 'New Biz', slug: 'new-biz', phone: null, email: null, address: null, city: 'Kyiv', category: 'salon', description: null, source: 'manual', status: 'NEW', tags: [], createdAt: '2026-01-03' });

    await leads.create({ businessName: 'New Biz', source: 'manual', category: 'salon' });

    expect(mockApi.post).toHaveBeenCalledWith('/leads', expect.objectContaining({ businessName: 'New Biz' }));
  });

  it('should update lead status', async () => {
    const mockApi = api as unknown as { put: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
    mockApi.get.mockResolvedValueOnce(mockLeads);
    mockApi.put.mockResolvedValueOnce({ ...mockLeads[0], status: 'CONTACTED' });

    await leads.fetchAll();
    await leads.updateStatus('1', 'CONTACTED');

    const state = get(leads);
    expect(state.leads[0].status).toBe('CONTACTED');
  });
});
