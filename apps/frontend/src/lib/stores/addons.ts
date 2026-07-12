import { writable } from 'svelte/store';
import { api } from '$lib/api/client';

export type AddonType = 'ONLINE_PAYMENT' | 'ONLINE_BOOKING' | 'CONTENT_MANAGEMENT';
export type AddonStatus = 'INACTIVE' | 'ACTIVE' | 'SUSPENDED';

export interface ProjectAddon {
  id: string;
  projectId: string;
  addonType: AddonType;
  status: AddonStatus;
  config: Record<string, unknown>;
  priceMonthly: number;
  activatedAt: string;
  expiresAt: string | null;
  createdAt: string;
}

export const ADDON_LABELS: Record<AddonType, string> = {
  ONLINE_PAYMENT: 'Online Payment',
  ONLINE_BOOKING: 'Online Booking',
  CONTENT_MANAGEMENT: 'Content Management',
};

export const ADDON_DESCRIPTIONS: Record<AddonType, string> = {
  ONLINE_PAYMENT: 'Accept payments directly on client website via LiqPay or Stripe',
  ONLINE_BOOKING: 'Appointment/booking system for services with calendar integration',
  CONTENT_MANAGEMENT: 'CMS panel for client to edit text, photos, and pricing independently',
};

export const ADDON_PRICES: Record<AddonType, number> = {
  ONLINE_PAYMENT: 499,
  ONLINE_BOOKING: 299,
  CONTENT_MANAGEMENT: 799,
};

export const ADDON_ICONS: Record<AddonType, string> = {
  ONLINE_PAYMENT: '💳',
  ONLINE_BOOKING: '📅',
  CONTENT_MANAGEMENT: '✏️',
};

interface AddonsState {
  addons: ProjectAddon[];
  isLoading: boolean;
  error: string | null;
}

function createAddonsStore() {
  const { subscribe, update } = writable<AddonsState>({
    addons: [],
    isLoading: false,
    error: null,
  });

  return {
    subscribe,
    async fetchForProject(projectId: string): Promise<ProjectAddon[]> {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const addons = await api.get<ProjectAddon[]>(`/projects/${projectId}/addons`);
        update((s) => ({ ...s, addons, isLoading: false }));
        return addons;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to fetch addons';
        update((s) => ({ ...s, isLoading: false, error: msg }));
        return [];
      }
    },
    async activate(projectId: string, addonType: AddonType): Promise<ProjectAddon> {
      const addon = await api.post<ProjectAddon>(`/projects/${projectId}/addons`, { addonType, config: {} });
      update((s) => ({ ...s, addons: [...s.addons, addon] }));
      return addon;
    },
    async deactivate(projectId: string, addonType: AddonType): Promise<void> {
      await api.delete(`/projects/${projectId}/addons/${addonType}`);
      update((s) => ({
        ...s,
        addons: s.addons.map((a) =>
          a.addonType === addonType ? { ...a, status: 'INACTIVE' as AddonStatus } : a,
        ),
      }));
    },
    async updateConfig(projectId: string, addonType: AddonType, config: Record<string, unknown>): Promise<ProjectAddon> {
      const addon = await api.put<ProjectAddon>(`/projects/${projectId}/addons/${addonType}`, config);
      update((s) => ({
        ...s,
        addons: s.addons.map((a) => (a.addonType === addonType ? addon : a)),
      }));
      return addon;
    },
  };
}

export const addons = createAddonsStore();
