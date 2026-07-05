import { w as writable } from './index.js-C88fsYC1.js';
import { a as api } from './client2-DL3MN81r.js';

function createLeadsStore() {
  const { subscribe, update } = writable({
    leads: [],
    isLoading: false,
    error: null
  });
  return {
    subscribe,
    async fetchAll(filters) {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const params = new URLSearchParams();
        if (filters?.search) params.set("search", filters.search);
        if (filters?.status) params.set("status", filters.status);
        if (filters?.city) params.set("city", filters.city);
        const query = params.toString();
        const leads2 = await api.get(`/leads${query ? `?${query}` : ""}`);
        update((s) => ({ ...s, leads: leads2, isLoading: false }));
      } catch (error) {
        update((s) => ({ ...s, isLoading: false, error: error instanceof Error ? error.message : "Failed to fetch leads" }));
      }
    },
    async create(data) {
      const lead = await api.post("/leads", data);
      update((s) => ({ ...s, leads: [lead, ...s.leads] }));
      return lead;
    },
    async updateStatus(id, status) {
      const lead = await api.put(`/leads/${id}`, { status });
      update((s) => ({
        ...s,
        leads: s.leads.map((l) => l.id === id ? lead : l)
      }));
      return lead;
    },
    async remove(id) {
      await api.delete(`/leads/${id}`);
      update((s) => ({ ...s, leads: s.leads.filter((l) => l.id !== id) }));
    }
  };
}
const leads = createLeadsStore();

export { leads as l };
//# sourceMappingURL=leads-yGJ56Jc6.js.map
