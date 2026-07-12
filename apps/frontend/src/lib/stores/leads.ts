import { writable } from 'svelte/store';
import { api } from '$lib/api/client';

export interface Lead {
  id: string;
  businessName: string;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  category: string | null;
  description: string | null;
  website: string | null;
  socialUrls: string[];
  source: string;
  status: string;
  tags: string[];
  scrapingEnabled: boolean;
  scrapedPhotos: string[];
  scrapedReviews: Array<Record<string, unknown>>;
  scrapedContacts: Record<string, unknown>;
  scrapedHours: Record<string, unknown>;
  enrichmentData?: Record<string, unknown> | null;
  enrichedAt?: string | null;
  enrichmentSources?: string[];
  createdAt: string;
  updatedAt: string;
}

interface LeadsState {
  leads: Lead[];
  isLoading: boolean;
  error: string | null;
}

function createLeadsStore() {
  const { subscribe, update } = writable<LeadsState>({
    leads: [],
    isLoading: false,
    error: null,
  });

  return {
    subscribe,
    async fetchAll(filters?: { search?: string; status?: string; city?: string }) {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const params = new URLSearchParams();
        if (filters?.search) params.set('search', filters.search);
        if (filters?.status) params.set('status', filters.status);
        if (filters?.city) params.set('city', filters.city);

        const query = params.toString();
        const leads = await api.get<Lead[]>(`/leads${query ? `?${query}` : ''}`);
        update((s) => ({ ...s, leads, isLoading: false }));
      } catch (error) {
        update((s) => ({ ...s, isLoading: false, error: error instanceof Error ? error.message : 'Failed to fetch leads' }));
      }
    },
    async fetchOne(id: string): Promise<Lead> {
      return api.get<Lead>(`/leads/${id}`);
    },
    async create(data: {
      businessName: string;
      source: string;
      category?: string;
      phone?: string;
      email?: string;
      city?: string;
      region?: string;
      country?: string;
      socialUrls?: string[];
    }) {
      const lead = await api.post<Lead>('/leads', data);
      update((s) => ({ ...s, leads: [lead, ...s.leads] }));
      return lead;
    },
    async update(id: string, data: Record<string, unknown>) {
      const lead = await api.put<Lead>(`/leads/${id}`, data);
      update((s) => ({
        ...s,
        leads: s.leads.map((l) => (l.id === id ? lead : l)),
      }));
      return lead;
    },
    async updateStatus(id: string, status: string) {
      const lead = await api.put<Lead>(`/leads/${id}`, { status });
      update((s) => ({
        ...s,
        leads: s.leads.map((l) => (l.id === id ? lead : l)),
      }));
      return lead;
    },
    async remove(id: string) {
      await api.delete(`/leads/${id}`);
      update((s) => ({ ...s, leads: s.leads.filter((l) => l.id !== id) }));
    },
    async scrape(leadId: string, platforms: string[]) {
      return api.post<{ jobId: string }>(`/leads/${leadId}/scrape`, { platforms });
    },
    async getScrapeStatus(leadId: string) {
      return api.get<{ jobs: Array<{ id: string; status: string; result?: unknown; error?: string }> }>(`/leads/${leadId}/scrape-status`);
    },
  };
}

export const leads = createLeadsStore();
