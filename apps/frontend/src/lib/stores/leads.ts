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
  category: string | null;
  description: string | null;
  source: string;
  status: string;
  tags: string[];
  createdAt: string;
}

interface LeadsState {
  leads: Lead[];
  isLoading: boolean;
  error: string | null;
}

function createLeadsStore() {
  const { subscribe, set, update } = writable<LeadsState>({
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
    async create(data: { businessName: string; source: string; category?: string }) {
      const lead = await api.post<Lead>('/leads', data);
      update((s) => ({ ...s, leads: [lead, ...s.leads] }));
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
  };
}

export const leads = createLeadsStore();
